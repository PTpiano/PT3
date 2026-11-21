import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap, ScrollTrigger, setMood, prefersReduced } from "@/motion";
import { useSite } from "@/store/store";
import { GalleryThumbnail, VideoPlayer } from "@/components/video";
import { PageHero } from "@/components/ui";
import type { GalleryItem } from "@/store/data";

function Lightbox({ items, index, onClose, onIndex }: { items: GalleryItem[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const it = items[index];
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(box.current, { opacity: 0 }, { opacity: 1, duration: 0.6 });
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onClose, onIndex]);
  return (
    <div ref={box} className="fixed inset-0 z-[300] bg-ink/95 backdrop-blur-md flex flex-col" onClick={onClose} data-lenis-prevent>
      <div className="flex justify-between items-center px-6 md:px-10 py-6 label">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} · {it.category}
        </span>
        <button onClick={onClose}>Chiudi ✕</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 md:px-24 relative" onClick={(e) => e.stopPropagation()}>
        <button className="absolute left-2 md:left-8 text-4xl text-bone-dim hover:text-amber z-10" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Precedente">
          ‹
        </button>
        {it.type === "video" && it.videoUrl ? (
          <VideoPlayer
            key={it.id}
            url={it.videoUrl}
            className="aspect-video max-h-full w-[min(92vw,1200px)] rounded-lg shadow-2xl shadow-black"
          />
        ) : (
          <GalleryThumbnail
            key={it.id}
            src={it.src}
            videoUrl={it.videoUrl}
            alt={it.caption}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl shadow-black"
            style={{ animation: "lb .9s cubic-bezier(.22,1,.36,1)" }}
          />
        )}
        <button className="absolute right-2 md:right-8 text-4xl text-bone-dim hover:text-amber z-10" onClick={() => onIndex((index + 1) % items.length)} aria-label="Successivo">
          ›
        </button>
      </div>
      <div className="text-center py-6 font-display italic text-2xl text-bone/90">{it.caption}</div>
      <style>{`@keyframes lb{from{opacity:0;transform:scale(1.06);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}`}</style>
    </div>
  );
}

export default function Gallery() {
  const { data } = useSite();
  const items = useMemo(() => data.gallery.filter((g) => g.published), [data.gallery]);
  const cats = useMemo(() => ["Tutte", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const [cat, setCat] = useState("Tutte");
  const [open, setOpen] = useState<number | null>(null);
  const shown = cat === "Tutte" ? items : items.filter((i) => i.category === cat);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => setMood("indigo"), []);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-g]").forEach((el, i) => {
        gsap.fromTo(el, { clipPath: "inset(100% 0 0 0)", y: 60 }, { clipPath: "inset(0% 0 0 0)", y: 0, duration: 1.6, ease: "expo.out", delay: (i % 3) * 0.1, scrollTrigger: { trigger: el, start: "top 92%", once: true } });
        const img = el.querySelector("[data-gi]");
        if (img) gsap.fromTo(img, { yPercent: -9, scale: 1.15 }, { yPercent: 9, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }, grid.current!);
    const t = setTimeout(() => ScrollTrigger.refresh(), 100);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [cat, shown.length]);

  const spans = { normal: "", tall: "row-span-2", wide: "md:col-span-2" };
  const heights = { normal: "aspect-[4/5]", tall: "aspect-[4/5] md:aspect-auto md:h-full", wide: "aspect-[4/5] md:aspect-[16/10]" };

  return (
    <>
      <PageHero kicker="Gallery" title={"Frammenti\ndi penombra"} sub="Luce bassa, ottoni spenti, tessuti che assorbono il suono: immagini dal palco, dalle corti e dalle sale d'ascolto." />
      <section className="relative px-6 md:px-14 pb-32">
        <div className="flex flex-wrap gap-3 mb-12">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`label !text-[0.62rem] px-5 py-2.5 rounded-full border transition-all duration-500 ${cat === c ? "bg-amber !text-ink border-amber" : "border-white/15 hover:border-amber"}`}>
              {c}
            </button>
          ))}
        </div>
        <div ref={grid} key={cat} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 [grid-auto-flow:dense]">
          {shown.map((g) => (
            <figure key={g.id} data-g className={`group relative overflow-hidden rounded-2xl ${spans[g.shape]}`} style={{ clipPath: "inset(0 0 0 0)" }}>
              <button onClick={() => setOpen(items.findIndex((x) => x.id === g.id))} className={`block w-full overflow-hidden ${heights[g.shape]}`} data-cursor="Apri">
                <div data-gi className="w-full h-full will-change-transform">
                  <GalleryThumbnail src={g.src} videoUrl={g.videoUrl} alt={g.caption} className="w-full h-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-105" />
                </div>
                {g.type === "video" && (
                  <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/65 text-bone backdrop-blur transition-colors group-hover:bg-amber group-hover:text-ink" aria-label="Video">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <figcaption className="absolute bottom-0 left-0 right-0 p-5 text-left translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
                  <div className="label !text-[0.55rem]">{g.category}</div>
                  <div className="font-display italic text-xl">{g.caption}</div>
                </figcaption>
              </button>
            </figure>
          ))}
        </div>
        {shown.length === 0 && <p className="font-display italic text-3xl text-bone-dim">Nessuna immagine in questa categoria.</p>}
      </section>
      {open !== null && items[open] && createPortal(<Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />, document.body)}
    </>
  );
}
