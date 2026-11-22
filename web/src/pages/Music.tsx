import { useEffect, useMemo, useRef, useState } from "react";
import { setMood, Reveal, MaskText, getLenis, prefersReduced } from "@/motion";
import { usePlayer } from "@/audio/PlayerContext";
import { useSite, fmtTime } from "@/store/store";
import type { Product, Track } from "@/store/data";
import { Img, PageHero, Btn } from "@/components/ui";

function Visualizer() {
  const p = usePlayer();
  const ref = useRef<HTMLCanvasElement>(null);
  const pr = useRef(p);
  pr.current = p;
  useEffect(() => {
    const cv = ref.current!;
    const c = cv.getContext("2d")!;
    const N = 56;
    const data = new Uint8Array(N);
    const smooth = new Float32Array(N);
    let raf = 0;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(2, devicePixelRatio || 1);
      cv.width = r.width * d;
      cv.height = r.height * d;
    };
    fit();
    window.addEventListener("resize", fit);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { width: W, height: H } = cv;
      c.clearRect(0, 0, W, H);
      pr.current.levels(data);
      const bw = W / N;
      for (let i = 0; i < N; i++) {
        const v = data[i] / 255;
        smooth[i] += (v - smooth[i]) * 0.25;
        const h = Math.max(2, smooth[i] * H * 0.95);
        const g = c.createLinearGradient(0, H, 0, H - h);
        g.addColorStop(0, "rgba(181,101,29,.9)");
        g.addColorStop(1, "rgba(243,217,164,.95)");
        c.fillStyle = g;
        c.fillRect(i * bw + bw * 0.22, H - h, bw * 0.56, h);
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);
  return <canvas ref={ref} className="w-full h-20 md:h-24" />;
}

const spotify = (u: string) => (u.includes("/embed/") ? u : u.replace("open.spotify.com/", "open.spotify.com/embed/"));
const sc = (u: string) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23e0a24a&auto_play=false&show_teaser=false&visual=false`;
const SELECTED_ALBUM_KEY = "nocturne.music.selectedAlbum";

function releaseTrackIds(release: Product, tracks: Track[]): string[] {
  const known = release.trackIds.filter((id) => tracks.some((track) => track.id === id && track.published));
  if (known.length) return known;

  // Alcuni album importati possono non avere ancora il collegamento esplicito:
  // in quel caso abbiniamo i brani che dichiarano lo stesso titolo nell'album.
  const title = release.title.trim().toLocaleLowerCase("it-IT");
  return tracks
    .filter((track) => track.published && track.subtitle.trim().toLocaleLowerCase("it-IT") === title)
    .map((track) => track.id);
}

export default function Music() {
  const p = usePlayer();
  const { data } = useSite();
  const cur = p.current;
  const pct = p.duration ? (p.progress / p.duration) * 100 : 0;
  const releases = useMemo(() => data.products.filter((product) => product.published), [data.products]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SELECTED_ALBUM_KEY);
    } catch {
      return null;
    }
  });
  const playerRef = useRef<HTMLElement>(null);
  const selected = releases.find((product) => product.id === selectedId) ?? releases[0] ?? null;
  const selectedTrackIds = useMemo(() => (selected ? releaseTrackIds(selected, data.tracks) : null), [data.tracks, selected]);

  const rememberRelease = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem(SELECTED_ALBUM_KEY, id);
      else sessionStorage.removeItem(SELECTED_ALBUM_KEY);
    } catch {
      /* la selezione resta comunque valida per la sessione corrente */
    }
  };

  /** Riporta il visitatore al giradischi e alla tracklist dell'album scelto. */
  const scrollToPlayer = () => {
    const target = playerRef.current;
    if (!target) return;
    // -100: lascia la copertina del giradischi sotto la nav fissa.
    if (prefersReduced()) {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: "auto" });
      return;
    }
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target, { offset: -100, duration: 1.1 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  };

  const selectRelease = (release: Product) => {
    setSelectedId(release.id);
    rememberRelease(release.id);
    // Aggiorna subito player e sfondo quando viene selezionata la copertina.
    p.setTracklist(releaseTrackIds(release, data.tracks));
    scrollToPlayer();
  };

  useEffect(() => setMood("copper"), []);
  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id);
      rememberRelease(selected.id);
    }
    p.setTracklist(selectedTrackIds);
  }, [p.setTracklist, selected, selectedId, selectedTrackIds]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    p.seek(((e.clientX - r.left) / r.width) * p.duration);
  };

  return (
    <>
      <PageHero kicker="Sala d'ascolto" title={"La musica,\ndal vivo"} sub="Premi play: i brani senza traccia caricata suonano come improvvisazioni generate in tempo reale al pianoforte — un assaggio della sala, finché non carichi i master dal pannello admin." />

      <section ref={playerRef} className="relative isolate px-6 md:px-14 pb-24 grid lg:grid-cols-12 gap-12 lg:gap-16">
        {selected && (
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 72%, transparent 100%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 22%, #000 72%, transparent 100%)",
            }}
          >
            <Img key={selected.id} src={selected.cover} className="w-full h-full object-cover opacity-[0.12] blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink/65 via-ink/88 to-ink" />
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 45%, rgba(224,162,74,.1), transparent 55%)" }} />
          </div>
        )}
        {/* DECK */}
        <div className="lg:col-span-6 lg:sticky lg:top-28 self-start">
          <Reveal y={50} clip>
            <div className="relative aspect-square w-full max-w-[34rem] mx-auto">
              {/* sleeve */}
              <div className="absolute inset-0 rounded-[1.6rem] overflow-hidden shadow-2xl shadow-black border border-white/10 bg-ink-2">
                <Img src={cur?.cover ?? data.tracks[0]?.cover} className="w-full h-full object-cover opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-ink/60" />
              </div>
              {/* platter */}
              <button onClick={p.toggle} data-cursor={p.playing ? "Pausa" : "Play"} className="absolute inset-[7%] rounded-full shadow-[0_20px_60px_rgba(0,0,0,.8)]" aria-label="Play / pausa">
                <div className={`absolute inset-0 rounded-full vinyl-grooves vinyl-spin`} style={{ animationPlayState: p.playing ? "running" : "paused" }}>
                  <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 30deg, transparent 0 10%, rgba(255,200,130,.14) 14%, transparent 20% 60%, rgba(255,200,130,.1) 66%, transparent 72%)" }} />
                  <div className="absolute inset-[33%] rounded-full overflow-hidden border-4 border-ink">
                    <Img src={cur?.cover ?? data.tracks[0]?.cover} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-[48.4%] rounded-full bg-ink" />
                </div>
              </button>
              {/* tonearm */}
              <div className="absolute top-[3%] right-[5%] w-[12%] h-[62%] origin-[50%_8%] transition-transform duration-[1800ms] ease-[cubic-bezier(.22,1,.36,1)] pointer-events-none" style={{ transform: `rotate(${p.playing ? 24 : -4}deg)` }}>
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-oxide to-copper shadow-lg" />
                <div className="absolute left-1/2 top-3 -translate-x-1/2 w-[3px] h-full bg-gradient-to-b from-oxide to-bone-dim rounded" />
                <div className="absolute left-1/2 bottom-0 -translate-x-[40%] w-5 h-9 rounded bg-ink-3 border border-oxide/40 rotate-[8deg]" />
              </div>
            </div>
          </Reveal>

          <div className="mt-10 max-w-[34rem] mx-auto">
            <div className="label mb-2">{cur ? `${cur.subtitle} · ${cur.year}` : "Seleziona un brano"}</div>
            <div className="font-display text-4xl md:text-5xl leading-none min-h-[1.1em]">{cur?.title ?? "Silenzio carico"}</div>
            <p className="text-bone-dim mt-3 min-h-[3rem]">{cur?.story ?? "Il silenzio che precede la prima nota."}</p>

            <div className="mt-6 opacity-90">
              <Visualizer />
            </div>
            <div onClick={seek} className="group relative h-6 flex items-center cursor-pointer" data-cursor="Cerca">
              <div className="w-full h-[3px] bg-white/10 rounded relative">
                <div className="absolute inset-y-0 left-0 bg-amber rounded" style={{ width: `${pct}%` }} />
                <div className="absolute top-1/2 w-3 h-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-oxide scale-0 group-hover:scale-100 transition" style={{ left: `${pct}%` }} />
              </div>
            </div>
            <div className="flex justify-between label !text-[0.58rem] !text-bone-dim">
              <span>{fmtTime(p.progress)}</span>
              <span>{fmtTime(p.duration || cur?.durationSec || 0)}</span>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={p.prev} className="w-11 h-11 rounded-full border border-white/15 hover:border-amber hover:text-amber transition" aria-label="Precedente">
                  ⏮
                </button>
                <button onClick={p.toggle} className="w-16 h-16 rounded-full bg-amber text-ink text-lg hover:scale-105 transition" aria-label="Play / pausa">
                  {p.playing ? "❚❚" : "▶"}
                </button>
                <button onClick={p.next} className="w-11 h-11 rounded-full border border-white/15 hover:border-amber hover:text-amber transition" aria-label="Successivo">
                  ⏭
                </button>
              </div>
              <label className="flex items-center gap-3 label !text-[0.58rem] !text-bone-dim">
                Vol
                <input type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => p.setVolume(+e.target.value)} className="w-24 accent-amber" />
              </label>
            </div>
          </div>
        </div>

        {/* PLAYLIST */}
        <div className="lg:col-span-6">
          <div className="label mb-6 flex justify-between">
            <span>Tracklist</span>
            <span className="!text-bone-dim">{p.tracks.length} brani</span>
          </div>
          <div className="border-t border-white/10">
            {p.tracks.map((t, i) => {
              const active = cur?.id === t.id;
              return (
                <Reveal key={t.id} y={24} delay={0.02 * i}>
                  <button onClick={() => (active ? p.toggle() : p.play(t.id))} data-cursor={active && p.playing ? "Pausa" : "Play"} className={`group w-full flex items-center gap-5 py-5 border-b border-white/10 text-left relative transition-colors ${active ? "bg-amber/[0.06]" : ""}`}>
                    <span className="label w-8 !text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
                    <Img src={t.cover} className={`w-16 h-16 object-cover rounded-md transition-transform duration-700 group-hover:scale-105 ${active ? "ring-1 ring-amber" : ""}`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block font-display text-2xl md:text-3xl leading-tight truncate ${active ? "text-amber display-it" : ""}`}>{t.title}</span>
                      <span className="block text-sm text-bone-dim truncate">
                        {t.subtitle} · {t.mood}
                      </span>
                    </span>
                    {active && p.playing ? (
                      <span className="flex items-end gap-[3px] h-5">
                        {[0, 1, 2].map((b) => (
                          <i key={b} className="w-[3px] bg-amber block origin-bottom" style={{ height: "100%", animation: `eq2 ${0.6 + b * 0.2}s ease-in-out infinite alternate` }} />
                        ))}
                      </span>
                    ) : (
                      <span className="w-9 h-9 rounded-full border border-white/15 grid place-items-center text-xs group-hover:bg-amber group-hover:text-ink group-hover:border-amber transition">▶</span>
                    )}
                    <span className="label !text-bone-dim w-12 text-right">{fmtTime(t.durationSec)}</span>
                  </button>
                </Reveal>
              );
            })}
          </div>
          <style>{`@keyframes eq2{from{transform:scaleY(.2)}to{transform:scaleY(1)}}`}</style>

          {(data.api.spotifyEmbed || data.api.soundcloudEmbed) && (
            <div className="mt-14 space-y-6">
              <div className="label">Anche su</div>
              {data.api.spotifyEmbed && <iframe title="Spotify" src={spotify(data.api.spotifyEmbed)} className="w-full h-[352px] rounded-2xl border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />}
              {data.api.soundcloudEmbed && <iframe title="SoundCloud" src={sc(data.api.soundcloudEmbed)} className="w-full h-[166px] rounded-2xl border-0" loading="lazy" />}
            </div>
          )}
        </div>
      </section>

      {/* releases */}
      <section className="relative px-6 md:px-14 py-24">
        <div className="label mb-5">Dischi</div>
        <MaskText as="h2" text={"Portali a casa"} className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-none mb-14" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {releases.map((pr, i) => (
            <Reveal key={pr.id} y={50} delay={i * 0.1}>
              <button type="button" onClick={() => selectRelease(pr)} aria-pressed={selected?.id === pr.id} data-cursor="Ascolta" className="group block w-full text-left">
                <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 relative">
                  <Img src={pr.cover} className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-4">
                  <div className="font-display text-2xl">{pr.title}</div>
                  <div className="label !text-[0.58rem] !text-bone-dim">{pr.type} · {pr.year}</div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
        <div className="mt-14">
          <Btn to={selected ? `/shop?album=${encodeURIComponent(selected.id)}` : "/shop"} label="Shop">
            Vai allo shop
          </Btn>
        </div>
      </section>
    </>
  );
}
