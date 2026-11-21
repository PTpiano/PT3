import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, prefersReduced, setMood } from "@/motion";
import { playKey } from "@/audio/PlayerContext";
import { Img } from "./ui";
import { useSrc } from "@/store/media";

/**
 * Scroll-scrubbed keyboard: the section is pinned and the scroll position is a "playhead".
 * Everything is a pure function of progress p (0..1) so it scrubs forward and backward.
 * If `videoUrl` is provided the same playhead scrubs a video (frame-by-frame) instead.
 */
const WHITE = 21;
const PHRASE: [number, number, number][] = [
  // [start, white-key index, length]
  [0.08, 7, 0.07], [0.13, 9, 0.07], [0.18, 11, 0.07], [0.23, 14, 0.1], [0.3, 12, 0.07], [0.35, 10, 0.06], [0.39, 9, 0.12],
  [0.5, 5, 0.07], [0.54, 8, 0.07], [0.58, 12, 0.07], [0.62, 16, 0.09], [0.68, 14, 0.06], [0.72, 11, 0.07], [0.77, 7, 0.14],
  [0.9, 3, 0.1], [0.9, 10, 0.1], [0.9, 14, 0.1],
];
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]); // pattern per octave of 7 whites (C D _ F G A _)
const MIDI_WHITE = [0, 2, 4, 5, 7, 9, 11];
const midiOf = (w: number) => 48 + Math.floor(w / 7) * 12 + MIDI_WHITE[w % 7];

export default function KeysScrub({ kicker, captions, image, videoUrl }: { kicker: string; captions: string[]; image: string; videoUrl: string }) {
  const sec = useRef<HTMLElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const caps = useRef<HTMLDivElement[]>([]);
  const prog = useRef(0);
  const manual = useRef<Record<number, number>>({});
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  soundRef.current = sound;
  const videoSrc = useSrc(videoUrl);

  useLayoutEffect(() => {
    const el = sec.current!;
    if (prefersReduced()) {
      prog.current = 0.5;
      if (caps.current[0]) caps.current[0].style.opacity = "1";
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=320%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          onUpdate: (self) => {
            prog.current = self.progress;
          },
          onToggle: (s) => s.isActive && setMood("copper"),
          onEnter: () => setMood("copper"),
          onEnterBack: () => setMood("copper"),
          onLeave: () => setMood("indigo"),
          onLeaveBack: () => setMood("indigo"),
        },
      });
      tl.fromTo(bg.current, { scale: 1.35, yPercent: -6 }, { scale: 1, yPercent: 4, ease: "none", duration: 1 }, 0);
      const n = caps.current.length;
      caps.current.forEach((c, i) => {
        const a = (i / n) * 0.95 + 0.02;
        tl.fromTo(c, { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.07, ease: "power2.out" }, a);
        if (i < n - 1) tl.to(c, { opacity: 0, y: -40, filter: "blur(10px)", duration: 0.07, ease: "power2.in" }, a + 0.25);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const canvas = cv.current!;
    const c = canvas.getContext("2d")!;
    let W = 0,
      H = 0,
      dpr = 1,
      raf = 0,
      visible = true;
    const press = new Array(WHITE).fill(0);
    const trail: { x: number; y: number; a: number; v: number }[] = [];
    const fired = new Set<number>();
    let lastP = 0;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = canvas.width = r.width * dpr;
      H = canvas.height = r.height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const p = prog.current;
      const v = vid.current;
      if (v && v.duration && v.readyState > 1) {
        const target = p * v.duration;
        if (Math.abs(target - v.currentTime) > 0.02) v.currentTime += (target - v.currentTime) * 0.35;
      }
      c.clearRect(0, 0, W, H);
      const kw = W / WHITE;
      const top = H * 0.2;
      const kh = H - top;
      // envelope for each key from the phrase (stateless => scrubbable)
      for (let i = 0; i < WHITE; i++) press[i] = 0;
      PHRASE.forEach(([s, k, len], idx) => {
        const x = p - s;
        if (x >= 0 && x <= len) press[k] = Math.max(press[k], Math.sin((x / len) * Math.PI) ** 0.5);
        if (x >= 0 && x < 0.22) {
          // light beads rising from the key
          const rise = x / 0.22;
          for (let j = 0; j < 7; j++) {
            const r2 = Math.max(0, rise - j * 0.03);
            trail.push({ x: (k + 0.5) * kw + Math.sin(r2 * 9 + k) * kw * 0.12, y: top - r2 * H * 0.9, a: (1 - rise) * (0.9 - j * 0.11), v: k });
          }
        }
        if (p >= s && lastP < s && !fired.has(idx) && soundRef.current) playKey(midiOf(k));
        if (p < s) fired.delete(idx);
        else if (p >= s) fired.add(idx);
      });
      lastP = p;
      for (const k in manual.current) {
        press[+k] = Math.max(press[+k], manual.current[k]);
        manual.current[k] *= 0.93;
        if (manual.current[k] < 0.01) delete manual.current[k];
      }
      // light beams
      c.globalCompositeOperation = "lighter";
      for (const t of trail) {
        const g = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, kw * 1.1);
        g.addColorStop(0, `rgba(255,190,100,${t.a * 0.55})`);
        g.addColorStop(1, "rgba(255,150,60,0)");
        c.fillStyle = g;
        c.fillRect(t.x - kw * 1.2, t.y - kw * 1.2, kw * 2.4, kw * 2.4);
      }
      trail.length = 0;
      c.globalCompositeOperation = "source-over";
      // white keys
      for (let i = 0; i < WHITE; i++) {
        const dp = press[i];
        const y = top + dp * 10 * dpr;
        const g = c.createLinearGradient(0, y, 0, H);
        g.addColorStop(0, `rgba(${230 + dp * 25},${205 + dp * 20},${160 + dp * 10},${0.9})`);
        g.addColorStop(1, "rgba(70,48,28,0.95)");
        c.fillStyle = g;
        c.fillRect(i * kw + 1.5 * dpr, y, kw - 3 * dpr, kh - dp * 10 * dpr);
        if (dp > 0.02) {
          c.fillStyle = `rgba(255,170,70,${dp * 0.35})`;
          c.fillRect(i * kw, top - 4 * dpr, kw, 8 * dpr);
        }
      }
      // black keys
      for (let i = 0; i < WHITE - 1; i++) {
        if (!BLACK_AFTER.has(i % 7)) continue;
        const bw = kw * 0.58;
        const x = (i + 1) * kw - bw / 2;
        const dp = Math.max(press[i], press[i + 1]) * 0.4;
        c.fillStyle = "#0b0705";
        c.fillRect(x, top, bw, kh * 0.6 - dp * 6 * dpr);
        c.fillStyle = "rgba(255,200,130,0.12)";
        c.fillRect(x + bw * 0.15, top, bw * 0.12, kh * 0.55);
      }
    };
    draw();

    const down = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const k = Math.floor(((e.clientX - r.left) / r.width) * WHITE);
      if (k >= 0 && k < WHITE) {
        manual.current[k] = 1;
        playKey(midiOf(k));
      }
    };
    canvas.addEventListener("pointerdown", down);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", down);
    };
  }, []);

  useEffect(() => {
    ScrollTrigger.refresh();
  }, [videoSrc]);

  return (
    <section ref={sec} className="relative h-screen overflow-hidden bg-ink" aria-label="Sequenza: le mani sulla tastiera">
      <div ref={bg} className="absolute inset-0 will-change-transform">
        {videoSrc ? (
          <video ref={vid} src={videoSrc} muted playsInline preload="auto" className="w-full h-full object-cover opacity-70" />
        ) : (
          <Img src={image} className="w-full h-full object-cover opacity-80" />
        )}
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #0a0705 0%, rgba(10,7,5,.2) 35%, rgba(10,7,5,.55) 70%, #0a0705 100%)" }} />
      <div className="absolute inset-0 vignette pointer-events-none" />

      <div className="absolute top-24 md:top-28 inset-x-0 px-6 md:px-14 flex items-center justify-between z-10">
        <div className="label">{kicker}</div>
        <button onClick={() => setSound((s) => !s)} className="label !text-bone/80 hover:!text-amber transition flex items-center gap-3" data-cursor={sound ? "On" : "Suono"}>
          <span className={`inline-block w-2 h-2 rounded-full ${sound ? "bg-amber animate-pulse" : "bg-bone/30"}`} />
          Suono {sound ? "on" : "off"}
        </button>
      </div>

      <div className="absolute inset-x-0 top-[34%] md:top-[30%] z-10 px-6 md:px-14 grid place-items-center text-center pointer-events-none">
        {captions.map((t, i) => (
          <div key={i} ref={(el) => void (el && (caps.current[i] = el))} className="col-start-1 row-start-1 font-display display-it text-[clamp(2.2rem,7vw,6.5rem)] leading-[0.95] opacity-0 max-w-4xl">
            {t}
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 inset-x-0 h-[34vh] md:h-[38vh] z-10">
        <canvas ref={cv} className="w-full h-full block touch-manipulation" data-cursor="Suona" />
        <div className="absolute -top-8 right-6 md:right-14 label !text-bone-dim !text-[0.58rem] pointer-events-none">Scorri per suonare · clicca i tasti</div>
      </div>
    </section>
  );
}
