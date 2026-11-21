import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSite } from "@/store/store";
import { resolveAsync } from "@/store/media";
import type { Track } from "@/store/data";
import { atmo } from "@/motion";

/* =====================================================================
   Audio engine
   - real files (url / uploaded blob) through <audio>
   - tracks without audio => generative modal-jazz piano (WebAudio)
   ===================================================================== */
let ctx: AudioContext | null = null;
let master: GainNode;
let analyser: AnalyserNode;
let localEl: HTMLAudioElement | null = null; // connected to analyser (blob:/data:)
let remoteEl: HTMLAudioElement | null = null; // plain element (cross-origin safe)

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensureCtx() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  const rev = ctx.createConvolver();
  rev.buffer = impulse(ctx, 3.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.42;
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 5200;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.84;
  master.connect(dry).connect(comp);
  master.connect(rev).connect(wet).connect(comp);
  comp.connect(warm).connect(analyser).connect(ctx.destination);
  return ctx;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function pianoNote(midi: number, t: number, dur: number, vel: number) {
  const c = ctx!;
  const f = mtof(midi);
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f * 7 + 900), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.28);
  g.gain.exponentialRampToValueAtTime(0.0003, t + dur);
  const parts: [OscillatorType, number, number][] = [
    ["triangle", 1, 1],
    ["sine", 2, 0.35],
    ["sine", 3.01, 0.12],
  ];
  parts.forEach(([type, mul, amp]) => {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type;
    o.frequency.value = f * mul;
    o.detune.value = (Math.random() - 0.5) * 6;
    og.gain.value = amp;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.1);
  });
  lp.connect(g).connect(master);
}

export function playKey(midi: number) {
  const c = ensureCtx();
  pianoNote(midi, c.currentTime + 0.01, 2.6, 0.5);
}

const MODES = [
  [0, 2, 3, 5, 7, 9, 10], // dorian
  [0, 1, 4, 5, 7, 8, 10], // phrygian dominant
  [0, 3, 5, 7, 10, 12, 15], // minor pentatonic-ish
];
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const rng = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

class Generative {
  timer = 0;
  step = 0;
  next = 0;
  deg = 4;
  beat: number;
  mode: number[];
  root: number;
  r: () => number;
  prog = [0, 5, 3, 4];
  constructor(seed: number) {
    this.r = rng(seed);
    this.mode = MODES[seed % MODES.length];
    this.beat = 60 / (56 + (seed % 22));
    this.root = 48 + (seed % 5);
    this.prog = [[0, 5, 3, 4], [0, 3, 1, 4], [0, 2, 5, 3]][seed % 3];
  }
  note(deg: number, oct = 0) {
    const L = this.mode.length;
    const o = Math.floor(deg / L);
    return this.root + oct * 12 + o * 12 + this.mode[((deg % L) + L) % L];
  }
  start() {
    const c = ensureCtx();
    this.next = c.currentTime + 0.12;
    const loop = () => {
      while (this.next < c.currentTime + 0.25) {
        this.schedule(this.next);
        const swing = this.step % 2 ? this.beat * 0.17 : 0;
        this.next += this.beat / 2;
        this.step++;
        void swing;
      }
    };
    loop();
    this.timer = window.setInterval(loop, 40);
  }
  schedule(t: number) {
    const s = this.step % 32;
    const bar = Math.floor(s / 8) % 4;
    const e = s % 8;
    const chord = this.prog[bar];
    const swing = e % 2 ? this.beat * 0.16 : 0;
    const at = t + swing;
    if (e === 0) {
      pianoNote(this.note(chord, -1), at, this.beat * 5, 0.34);
      [0, 2, 4, 6].forEach((k, i) => pianoNote(this.note(chord + k, 0), at + 0.02 + i * 0.035, this.beat * 4, 0.12));
    }
    if (e === 4 && this.r() > 0.35) pianoNote(this.note(chord + 4, -1), at, this.beat * 2.5, 0.22);
    if (e === 3 && this.r() > 0.7) pianoNote(this.note(chord + 2, 0), at, this.beat * 2, 0.1);
    const p = this.r();
    if (p < 0.5) {
      const choices = [-2, -1, -1, 1, 1, 2, 3, -3];
      this.deg += choices[Math.floor(this.r() * choices.length)];
      this.deg = Math.max(1, Math.min(11, this.deg));
      pianoNote(this.note(this.deg, 1), at, this.beat * (1.2 + this.r() * 2.6), 0.22 + this.r() * 0.18);
    }
  }
  stop() {
    clearInterval(this.timer);
  }
}

/* =====================================================================
   Context
   ===================================================================== */
interface PlayerState {
  tracks: Track[];
  current: Track | null;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  play: (id?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (s: number) => void;
  setVolume: (v: number) => void;
  /** Seleziona la tracklist del player; null ripristina tutti i brani pubblicati. */
  setTracklist: (ids: string[] | null) => void;
  levels: (out: Uint8Array) => void;
}
const PCtx = createContext<PlayerState>(null!);
export const usePlayer = () => useContext(PCtx);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { data } = useSite();
  const allTracks = useMemo(() => data.tracks.filter((t) => t.published), [data.tracks]);
  const [tracklistIds, setTracklistIds] = useState<string[] | null>(null);
  const tracks = useMemo(() => {
    if (tracklistIds === null) return allTracks;
    const byId = new Map(allTracks.map((track) => [track.id, track]));
    return tracklistIds.map((id) => byId.get(id)).filter((track): track is Track => !!track);
  }, [allTracks, tracklistIds]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentId;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVol] = useState(0.85);
  const gen = useRef<Generative | null>(null);
  const el = useRef<HTMLAudioElement | null>(null);
  const synthClock = useRef({ start: 0, offset: 0, running: false });
  const [audioDur, setAudioDur] = useState(0);
  const playingRef = useRef(false);
  playingRef.current = playing;

  const current = allTracks.find((t) => t.id === currentId) ?? null;
  const isSynth = !!current && !current.audio;
  const duration = isSynth ? current!.durationSec : audioDur || current?.durationSec || 0;

  const stopAll = useCallback(() => {
    gen.current?.stop();
    gen.current = null;
    if (synthClock.current.running && ctx) synthClock.current.offset += ctx.currentTime - synthClock.current.start;
    synthClock.current.running = false;
    el.current?.pause();
  }, []);

  const setTracklist = useCallback(
    (ids: string[] | null) => {
      setTracklistIds((previous) => {
        if (previous === null && ids === null) return previous;
        if (previous !== null && ids !== null && previous.length === ids.length && previous.every((id, i) => id === ids[i])) return previous;
        return ids;
      });

      const availableIds = ids === null ? allTracks.map((track) => track.id) : ids.filter((id) => allTracks.some((track) => track.id === id));
      if (currentIdRef.current && !availableIds.includes(currentIdRef.current)) {
        stopAll();
        setCurrentId(null);
        setProgress(0);
        setPlaying(false);
      }
    },
    [allTracks, stopAll]
  );

  const startTrack = useCallback(
    async (t: Track, from = 0) => {
      stopAll();
      if (!t.audio) {
        const c = ensureCtx();
        const g = new Generative(hash(t.id + t.title));
        g.step = 0;
        g.start();
        gen.current = g;
        synthClock.current = { start: c.currentTime, offset: from, running: true };
        el.current = null;
      } else {
        const src = await resolveAsync(t.audio);
        const local = src.startsWith("blob:") || src.startsWith("data:");
        let a: HTMLAudioElement;
        if (local) {
          const c = ensureCtx();
          if (!localEl) {
            localEl = new Audio();
            c.createMediaElementSource(localEl).connect(master);
          }
          a = localEl;
        } else {
          remoteEl = remoteEl || new Audio();
          a = remoteEl;
        }
        a.onloadedmetadata = () => setAudioDur(a.duration);
        a.onended = () => nextRef.current();
        a.src = src;
        a.volume = local ? 1 : volume;
        a.currentTime = from;
        el.current = a;
        try {
          await a.play();
        } catch {
          setPlaying(false);
          return;
        }
      }
      setPlaying(true);
    },
    [stopAll, volume]
  );

  const idx = tracks.findIndex((t) => t.id === currentId);
  const nextRef = useRef(() => {});
  nextRef.current = () => {
    if (!tracks.length) return;
    const n = tracks[(idx + 1 + tracks.length) % tracks.length];
    setCurrentId(n.id);
    setProgress(0);
    startTrack(n);
  };

  const play = useCallback(
    (id?: string) => {
      const t = (id && (tracks.find((x) => x.id === id) || allTracks.find((x) => x.id === id))) || current || tracks[0];
      if (!t) return;
      if (t.id === currentId && !playing) {
        // resume
        if (!t.audio) {
          const c = ensureCtx();
          const g = new Generative(hash(t.id + t.title));
          g.start();
          gen.current = g;
          synthClock.current = { start: c.currentTime, offset: synthClock.current.offset, running: true };
          setPlaying(true);
        } else {
          el.current?.play();
          setPlaying(true);
        }
        return;
      }
      if (t.id === currentId && playing) return;
      setCurrentId(t.id);
      setProgress(0);
      startTrack(t);
    },
    [allTracks, tracks, current, currentId, playing, startTrack]
  );

  const pause = useCallback(() => {
    stopAll();
    setPlaying(false);
  }, [stopAll]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);
  const next = useCallback(() => nextRef.current(), []);
  const prev = useCallback(() => {
    if (!tracks.length) return;
    const position = Math.max(idx, 0);
    const n = tracks[(position - 1 + tracks.length) % tracks.length];
    setCurrentId(n.id);
    setProgress(0);
    startTrack(n);
  }, [tracks, idx, startTrack]);

  const seek = useCallback(
    (s: number) => {
      setProgress(s);
      if (isSynth) {
        const c = ensureCtx();
        synthClock.current = { start: c.currentTime, offset: s, running: synthClock.current.running };
      } else if (el.current) el.current.currentTime = s;
    },
    [isSynth]
  );

  const setVolume = useCallback((v: number) => {
    setVol(v);
    if (master) master.gain.value = v;
    if (remoteEl) remoteEl.volume = v;
  }, []);

  // progress ticker
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (isSynth && ctx && synthClock.current.running) {
        const p = synthClock.current.offset + (ctx.currentTime - synthClock.current.start);
        if (p >= duration) nextRef.current();
        else setProgress(p);
      } else if (el.current) setProgress(el.current.currentTime);
    }, 250);
    return () => clearInterval(id);
  }, [playing, isSynth, duration]);

  // energy for the atmosphere (light pulsing with music)
  const buf = useRef(new Uint8Array(128));
  const levels = useCallback(
    (out: Uint8Array) => {
      const real = analyser && playingRef.current && (isSynth || (el.current && el.current === localEl));
      if (real) {
        analyser.getByteFrequencyData(buf.current);
        for (let i = 0; i < out.length; i++) out[i] = buf.current[Math.min(buf.current.length - 1, Math.floor(i * 1.4))];
      } else if (playingRef.current) {
        const t = performance.now() / 1000;
        for (let i = 0; i < out.length; i++) out[i] = 70 + 70 * Math.sin(t * 2 + i * 0.5) * Math.sin(t * 0.7 + i * 0.13);
      } else out.fill(0);
    },
    [isSynth]
  );

  useEffect(() => {
    let raf = 0;
    const tmp = new Uint8Array(32);
    const loop = () => {
      levels(tmp);
      let s = 0;
      for (let i = 0; i < 10; i++) s += tmp[i];
      atmo.energy += (s / 10 / 255 - atmo.energy) * 0.12;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levels]);

  const value: PlayerState = { tracks, current, playing, progress, duration, volume, play, toggle, next, prev, seek, setVolume, setTracklist, levels };
  return <PCtx.Provider value={value}>{children}</PCtx.Provider>;
}
