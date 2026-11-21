import { useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, MaskText, Reveal, TLink, introFlag, setMood, prefersReduced, isCoarse, type Mood } from "@/motion";
import { useSite, fmtTime, fmtMoney } from "@/store/store";
import { usePlayer } from "@/audio/PlayerContext";
import { Img, Btn, SmokeDivider, Stave, fmtDate } from "@/components/ui";
import KeysScrub from "@/components/KeysScrub";

/* ───────────────────────────── HERO ───────────────────────────── */
function Hero() {
  const { data } = useSite();
  const h = data.content.hero;
  const sec = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const D = introFlag.pending ? 3.4 : 0;

  useLayoutEffect(() => {
    const el = sec.current!;
    const ctx = gsap.context(() => {
      setMood("amber");
      if (prefersReduced()) return;
      gsap.fromTo(intro.current, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 3.6, ease: "expo.out", delay: D });
      gsap.fromTo(cue.current, { opacity: 0 }, { opacity: 1, duration: 2, delay: 2.4 + D });
      gsap.fromTo(txt.current!.querySelectorAll("[data-fade]"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 2, delay: 1.6 + D, stagger: 0.25, ease: "expo.out" });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top top", end: "+=100%", scrub: 0.9, pin: true, anticipatePin: 1 } });
      tl.to(bg.current, { scale: 1.45, yPercent: 10, ease: "none" }, 0)
        .to(glow.current, { scale: 2.2, opacity: 0.9, ease: "none" }, 0)
        .to(txt.current, { yPercent: -28, opacity: 0, ease: "none" }, 0)
        .to(txt.current!.querySelector("[data-spread]"), { letterSpacing: "0.12em", ease: "none" }, 0)
        .to(cue.current, { opacity: 0, duration: 0.2 }, 0)
        .to(veil.current, { opacity: 1, ease: "power1.in" }, 0.35);

      if (!isCoarse()) {
        const qx = gsap.quickTo(intro.current, "x", { duration: 1.6, ease: "power3.out" });
        const qy = gsap.quickTo(intro.current, "y", { duration: 1.6, ease: "power3.out" });
        const gx = gsap.quickTo(glow.current, "x", { duration: 1.2, ease: "power3.out" });
        const gy = gsap.quickTo(glow.current, "y", { duration: 1.2, ease: "power3.out" });
        const mv = (e: MouseEvent) => {
          const nx = e.clientX / innerWidth - 0.5;
          const ny = e.clientY / innerHeight - 0.5;
          qx(-nx * 36);
          qy(-ny * 24);
          gx(nx * 160);
          gy(ny * 100);
        };
        el.addEventListener("mousemove", mv);
        return () => el.removeEventListener("mousemove", mv);
      }
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sec} className="relative h-screen overflow-hidden bg-ink">
      <div ref={intro} className="absolute -inset-[6%]">
        <div ref={bg} className="absolute inset-0 will-change-transform">
          <Img src={h.image} className="w-full h-full object-cover" />
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0a0705 4%, rgba(10,7,5,.35) 45%, rgba(10,7,5,.75) 100%)" }} />
      <div ref={glow} className="absolute left-[55%] top-[28%] w-[44vw] h-[44vw] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,170,70,.32), rgba(181,101,29,.12) 45%, transparent 70%)", mixBlendMode: "screen", animation: "breathe-glow 6s ease-in-out infinite" }} />
      <style>{`@keyframes breathe-glow{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      <div className="absolute inset-0 vignette pointer-events-none" />

      <div ref={txt} className="relative z-10 h-full flex flex-col justify-end px-6 md:px-14 pb-[13vh] md:pb-[11vh]">
        <div data-fade className="label mb-6 md:mb-8 flex items-center gap-4">
          <span className="w-10 h-px bg-amber inline-block" />
          {h.kicker}
        </div>
        <div data-spread style={{ letterSpacing: "-0.03em" }}>
          <MaskText as="h1" text={`${h.line1}\n${h.line2}`} italicFrom={1} delay={0.9 + D} stagger={0.14} start="top 100%" className="font-display breathe text-[clamp(4.6rem,19vw,19rem)] leading-[0.8]" />
        </div>
        <div className="mt-8 md:mt-10 flex flex-wrap items-end justify-between gap-8">
          <p data-fade className="max-w-md font-display italic text-xl md:text-2xl text-bone/80 leading-snug">
            {h.tagline}
          </p>
          <div data-fade className="flex gap-4">
            <Btn solid to="/musica" label="Musica">
              {h.cta2}
            </Btn>
          </div>
        </div>
      </div>

      <div ref={cue} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 opacity-0">
        <span className="label !text-[0.58rem] !text-bone-dim">{h.cta1}</span>
        <span className="relative w-px h-12 bg-white/15 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-amber" style={{ animation: "cue 2.2s ease-in-out infinite" }} />
        </span>
        <style>{`@keyframes cue{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
      </div>
      <div ref={veil} className="absolute inset-0 bg-ink opacity-0 pointer-events-none z-20" />
    </section>
  );
}

/* ───────────────────────────── MANIFESTO ───────────────────────────── */
function Manifesto() {
  const { data } = useSite();
  const words = data.content.manifesto.split(" ");
  const sec = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = sec.current!;
    if (prefersReduced()) {
      el.querySelectorAll("[data-w]").forEach((w) => ((w as HTMLElement).style.opacity = "1"));
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top top", end: "+=220%", scrub: 0.9, pin: true, anticipatePin: 1, onEnter: () => setMood("indigo"), onEnterBack: () => setMood("indigo"), onLeaveBack: () => setMood("amber") },
      });
      tl.fromTo("[data-stave]", { scaleX: 0 }, { scaleX: 1, stagger: 0.06, duration: 0.5, ease: "power2.out" }, 0)
        .fromTo("[data-mark]", { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.5, duration: 0.4 }, 0.3)
        .fromTo("[data-w]", { opacity: 0.07, y: 14 }, { opacity: 1, y: 0, stagger: 0.09, duration: 0.5, ease: "none" }, 0.2)
        .to({}, { duration: 0.8 });
    }, el);
    return () => ctx.revert();
  }, [data.content.manifesto]);

  return (
    <section ref={sec} className="relative h-screen overflow-hidden grid place-items-center px-6 md:px-14">
      <SmokeDivider />
      <Stave className="absolute left-0 right-0 top-1/2 -translate-y-1/2 opacity-70 px-6 md:px-14" />
      <span data-mark className="font-hand text-amber/80 text-3xl absolute left-[6%] top-[18%] -rotate-6">pp</span>
      <span data-mark className="font-hand text-amber/80 text-3xl absolute right-[8%] top-[24%] rotate-3">rubato…</span>
      <span data-mark className="font-hand text-amber/80 text-4xl absolute right-[12%] bottom-[16%] -rotate-3">♩ = 62</span>
      <p className="relative z-10 max-w-5xl font-display text-[clamp(1.7rem,4.3vw,4rem)] leading-[1.15] text-center">
        {words.map((w, i) => (
          <span key={i} data-w className="inline-block mr-[0.26em]" style={{ opacity: 0.07 }}>
            {w}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ───────────────────────────── CHAPTERS (pinned, layered) ───────────────────────────── */
const CH_MOODS: Mood[] = ["green", "indigo", "copper", "amber"];
function Chapters() {
  const { data } = useSite();
  const ch = data.content.chapters;
  const sec = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = sec.current!;
    if (prefersReduced() || ch.length < 2) return;
    const ctx = gsap.context(() => {
      const imgs = gsap.utils.toArray<HTMLElement>("[data-img]");
      const inner = gsap.utils.toArray<HTMLElement>("[data-inner]");
      const texts = gsap.utils.toArray<HTMLElement>("[data-txt]");
      const nums = gsap.utils.toArray<HTMLElement>("[data-num]");
      gsap.set(imgs.slice(1), { clipPath: "inset(100% 0 0 0)" });
      gsap.set(texts.slice(1), { opacity: 0, y: 70 });
      gsap.set(nums.slice(1), { opacity: 0, yPercent: 40 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: `+=${ch.length * 85}%`,
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
          onUpdate: (s) => setMood(CH_MOODS[Math.min(ch.length - 1, Math.floor(s.progress * ch.length * 0.999)) % CH_MOODS.length]),
          onEnter: () => setMood(CH_MOODS[0]),
          onLeaveBack: () => setMood("indigo"),
        },
      });
      for (let i = 1; i < ch.length; i++) {
        const at = i - 1;
        tl.to(imgs[i], { clipPath: "inset(0% 0 0 0)", duration: 1, ease: "power2.inOut" }, at)
          .fromTo(inner[i], { scale: 1.4, yPercent: 8 }, { scale: 1, yPercent: 0, duration: 1.2, ease: "power2.out" }, at)
          .to(inner[i - 1], { scale: 0.92, duration: 1, ease: "none" }, at)
          .to(texts[i - 1], { opacity: 0, y: -70, duration: 0.45, ease: "power2.in" }, at)
          .to(nums[i - 1], { opacity: 0, yPercent: -40, duration: 0.5 }, at)
          .fromTo(texts[i], { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, at + 0.5)
          .fromTo(nums[i], { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: 0.55 }, at + 0.5);
      }
      tl.to({}, { duration: 0.7 });
      tl.fromTo("[data-bar]", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: tl.duration() }, 0);
    }, el);
    return () => ctx.revert();
  }, [ch.length]);

  if (prefersReduced()) {
    return (
      <section className="relative px-6 md:px-14 py-24 space-y-24">
        {ch.map((c) => (
          <div key={c.id} className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="label mb-4">{c.num}</div>
              <h3 className="font-display text-5xl mb-4">{c.title}</h3>
              <p className="text-bone/75 text-lg leading-relaxed max-w-md">{c.text}</p>
            </div>
            <Img src={c.image} className="w-full aspect-[4/3] object-cover rounded-3xl" />
          </div>
        ))}
      </section>
    );
  }
  return (
    <section ref={sec} className="relative h-screen overflow-hidden bg-ink/90">
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 ml-3 md:ml-8 z-20">
        <div data-bar className="w-full h-full bg-amber origin-top" />
      </div>
      <div className="h-full grid md:grid-cols-12 items-center gap-6 md:gap-10 px-6 md:px-14 pt-24 pb-8">
        <div className="md:col-span-5 order-2 md:order-1 relative">
          <div className="label mb-4 md:mb-8">Capitolo — la suite si svela</div>
          <div className="relative h-[8rem] md:h-[11rem] mb-2 overflow-hidden">
            {ch.map((c, i) => (
              <div key={c.id} data-num className="absolute inset-0 font-display display-it text-[7rem] md:text-[10rem] leading-none text-transparent" style={{ WebkitTextStroke: "1px rgba(224,162,74,.65)", opacity: i ? 0 : 1 }}>
                {c.num}
              </div>
            ))}
          </div>
          <div className="grid">
            {ch.map((c) => (
              <div key={c.id} data-txt className="col-start-1 row-start-1">
                <h3 className="font-display text-5xl md:text-7xl leading-none mb-4 md:mb-6">{c.title}</h3>
                <p className="text-bone/75 text-base md:text-lg leading-relaxed max-w-md">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-7 order-1 md:order-2 relative h-[38vh] md:h-[74vh]">
          {ch.map((c, i) => (
            <div key={c.id} data-img className="absolute inset-0 overflow-hidden rounded-[1.6rem] md:rounded-[2.4rem]" style={{ zIndex: i }}>
              <div data-inner className="absolute inset-0 will-change-transform">
                <Img src={c.image} className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
              <span className="absolute bottom-4 left-5 label !text-bone/70 !text-[0.58rem]">
                {c.num} · {c.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── SETLIST (horizontal pin) ───────────────────────────── */
function Setlist() {
  const { data } = useSite();
  const list = data.content.projects;
  const sec = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = sec.current!;
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      const dist = () => track.current!.scrollWidth - window.innerWidth;
      const tween = gsap.to(track.current, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: () => `+=${dist() * 1.1}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1, onEnter: () => setMood("green"), onEnterBack: () => setMood("green") },
      });
      gsap.utils.toArray<HTMLElement>("[data-pimg]").forEach((img) => {
        gsap.fromTo(img, { xPercent: 14 }, { xPercent: -14, ease: "none", scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-pcard]").forEach((card) => {
        gsap.fromTo(card, { clipPath: "inset(14% 0 14% 0)", opacity: 0.4 }, { clipPath: "inset(0% 0 0% 0)", opacity: 1, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 98%", end: "left 55%", scrub: true } });
      });
    }, el);
    return () => ctx.revert();
  }, [list.length]);

  const reduced = prefersReduced();
  return (
    <section ref={sec} className={reduced ? "relative py-24 overflow-x-auto" : "relative h-screen overflow-hidden"}>
      {!reduced && <SmokeDivider />}
      <div ref={track} className="flex h-full items-center gap-[6vw] pl-6 md:pl-14 pr-[20vw] will-change-transform w-max">
        <div className="shrink-0 w-[78vw] md:w-[38vw]">
          <div className="label mb-6">Setlist · progetti come brani</div>
          <h2 className="font-display breathe text-[clamp(3rem,8vw,8rem)] leading-[0.9]">
            Una suite
            <br />
            <span className="display-it text-amber">improvvisata</span>
          </h2>
          <p className="mt-8 text-bone-dim max-w-sm">Scorri: ogni progetto entra come un nuovo brano, uno dopo l'altro, senza applausi in mezzo.</p>
          <div className="mt-8 font-hand text-3xl text-amber/80">→ attacca il primo tema</div>
        </div>
        {list.map((p) => (
          <article key={p.id} data-pcard className="shrink-0 w-[78vw] md:w-[30vw] h-[68vh] md:h-[72vh] relative rounded-[2rem] overflow-hidden border border-white/10 bg-ink-2">
            <div className="absolute inset-0 overflow-hidden">
              <div data-pimg className="absolute -inset-x-[16%] inset-y-0 will-change-transform">
                <Img src={p.image} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
            <div className="absolute top-5 left-6 right-6 flex justify-between label !text-bone/80">
              <span>{p.num}.</span>
              <span>{p.year}</span>
            </div>
            <div className="absolute bottom-0 p-6 md:p-8">
              <div className="label !text-[0.58rem] mb-3">{p.tag}</div>
              <h3 className="font-display text-4xl md:text-5xl leading-none mb-4">{p.title}</h3>
              <p className="text-bone/70 text-sm md:text-base leading-relaxed">{p.text}</p>
            </div>
          </article>
        ))}
        <div className="shrink-0 w-[60vw] md:w-[26vw]">
          <div className="font-display display-it text-5xl md:text-6xl text-bone/90 leading-tight">…e la serata continua.</div>
          <div className="mt-8">
            <Btn to="/musica" label="Musica">
              Ascolta la suite
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── MARQUEE ───────────────────────────── */
function Marquee() {
  const { data } = useSite();
  const words = data.content.marquee;
  const row = [...words, ...words, ...words, ...words];
  return (
    <div className="relative py-10 md:py-16 overflow-hidden border-y border-white/10 -rotate-[1.2deg] scale-[1.03] bg-ink-2/70 backdrop-blur-sm">
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={i} className={`font-display text-[clamp(3rem,9vw,8rem)] leading-none px-6 md:px-10 flex items-center gap-6 md:gap-10 ${i % 2 ? "display-it text-amber" : "text-transparent"}`} style={i % 2 ? undefined : { WebkitTextStroke: "1px rgba(239,227,207,.55)" }}>
                {w}
                <span className="text-amber text-2xl">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── LISTEN ───────────────────────────── */
function Listen() {
  const p = usePlayer();
  const rows = p.tracks.slice(0, 5);
  const [hover, setHover] = useState<string | null>(null);
  const pv = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLElement>(null);
  const hovered = rows.find((t) => t.id === hover);

  useLayoutEffect(() => {
    if (isCoarse()) return;
    const x = gsap.quickTo(pv.current, "x", { duration: 0.7, ease: "power3.out" });
    const y = gsap.quickTo(pv.current, "y", { duration: 0.7, ease: "power3.out" });
    const mv = (e: MouseEvent) => {
      x(e.clientX + 30);
      y(e.clientY - 120);
    };
    window.addEventListener("mousemove", mv);
    return () => window.removeEventListener("mousemove", mv);
  }, []);
  useLayoutEffect(() => {
    gsap.to(pv.current, { opacity: hover ? 1 : 0, scale: hover ? 1 : 0.85, rotate: hover ? -3 : 4, duration: 0.6, ease: "expo.out" });
  }, [hover]);

  return (
    <section ref={secRef} className="relative px-6 md:px-14 py-32 md:py-48" onMouseEnter={() => setMood("copper")}>
      <div className="flex flex-wrap items-end justify-between gap-6 mb-16">
        <div>
          <div className="label mb-5">Ascolto</div>
          <MaskText as="h2" text={"Un metro dal\npianoforte"} italicFrom={1} className="font-display breathe text-[clamp(3rem,8vw,8rem)] leading-[0.9]" />
        </div>
        <Btn to="/musica" label="Musica">
          Tutta la musica
        </Btn>
      </div>
      <div className="border-t border-white/10">
        {rows.map((t, i) => {
          const active = p.current?.id === t.id;
          return (
            <Reveal key={t.id} y={30} delay={i * 0.05}>
              <button onClick={() => (active && p.playing ? p.toggle() : p.play(t.id))} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} data-cursor={active && p.playing ? "Pausa" : "Play"} className="group w-full text-left grid grid-cols-12 items-center gap-4 py-6 md:py-8 border-b border-white/10 relative overflow-hidden">
                <span className="absolute inset-0 bg-amber/[0.07] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out" />
                <span className="col-span-2 md:col-span-1 label relative">{String(i + 1).padStart(2, "0")}</span>
                <span className={`col-span-10 md:col-span-6 font-display text-3xl md:text-5xl leading-tight relative transition-transform duration-700 group-hover:translate-x-3 ${active ? "text-amber display-it" : ""}`}>{t.title}</span>
                <span className="hidden md:block col-span-3 text-bone-dim relative">
                  {t.subtitle} · {t.mood}
                </span>
                <span className="hidden md:flex col-span-2 justify-end items-center gap-4 relative">
                  {active && p.playing && (
                    <span className="flex items-end gap-[3px] h-5">
                      {[0, 1, 2, 3].map((b) => (
                        <i key={b} className="w-[3px] bg-amber block" style={{ height: "100%", animation: `eq ${0.7 + b * 0.18}s ease-in-out infinite alternate` }} />
                      ))}
                    </span>
                  )}
                  <span className="label !text-bone-dim">{fmtTime(t.durationSec)}</span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
      <style>{`@keyframes eq{from{transform:scaleY(.2)}to{transform:scaleY(1)}} [style*="eq"]{transform-origin:bottom}`}</style>
      <div ref={pv} className="fixed top-0 left-0 w-56 h-56 md:w-64 md:h-64 z-[50] pointer-events-none opacity-0 rounded-xl overflow-hidden shadow-2xl shadow-black">
        {hovered && <Img src={hovered.cover} className="w-full h-full object-cover" />}
      </div>
    </section>
  );
}

/* ───────────────────────────── SHOP TEASER ───────────────────────────── */
function ShopTeaser() {
  const { data } = useSite();
  const p = data.products.find((x) => x.featured && x.published) || data.products.find((x) => x.published);
  const sec = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!p || prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-disc]", { xPercent: 0, rotate: 0 }, { xPercent: 42, rotate: 260, ease: "none", scrollTrigger: { trigger: sec.current, start: "top 70%", end: "center 40%", scrub: 1 } });
      gsap.fromTo("[data-sleeve]", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", ease: "power3.out", duration: 1.8, scrollTrigger: { trigger: sec.current, start: "top 75%", once: true } });
    }, sec.current!);
    return () => ctx.revert();
  }, [p?.id]);
  if (!p) return null;
  const min = Math.min(...p.formats.map((f) => (f.pwyw ? f.min : f.price)));
  return (
    <section ref={sec} className="relative px-6 md:px-14 py-28 md:py-44" onMouseEnter={() => setMood("indigo")}>
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div className="relative aspect-square max-w-xl w-full mx-auto">
          <div data-disc className="absolute inset-[3%] rounded-full vinyl-grooves shadow-2xl shadow-black will-change-transform">
            <div className="absolute inset-[34%] rounded-full overflow-hidden">
              <Img src={p.cover} className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-[48.5%] rounded-full bg-ink" />
          </div>
          <div data-sleeve className="absolute inset-0 w-[88%] rounded-md overflow-hidden shadow-2xl shadow-black">
            <Img src={p.cover} className="w-full h-full object-cover" />
          </div>
        </div>
        <div>
          <div className="label mb-5">Shop · {p.type} · {p.year}</div>
          <MaskText as="h2" text={p.title} className="font-display text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.92] mb-8" />
          <Reveal y={20}>
            <p className="text-bone/75 text-lg max-w-md leading-relaxed mb-8">{p.description}</p>
            <div className="flex flex-wrap gap-2 mb-10">
              {p.formats.map((f) => (
                <span key={f.id} className="label !text-[0.58rem] border border-white/15 rounded-full px-3 py-1.5 !text-bone/80">
                  {f.kind.toUpperCase()}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <Btn solid to="/shop" label="Shop">
                Scopri i formati
              </Btn>
              <span className="font-display text-xl text-bone-dim">{min === 0 ? "Digitale a offerta libera — anche 0" : `da ${fmtMoney(min, data.settings.currency)}`}</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── EVENTS ───────────────────────────── */
function Events() {
  const { data } = useSite();
  const today = new Date().toISOString().slice(0, 10);
  const ev = data.events.filter((e) => e.published && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="relative px-6 md:px-14 py-28 md:py-40" onMouseEnter={() => setMood("amber")}>
      <div className="label mb-5">Prossime serate</div>
      <MaskText as="h2" text={"Dal vivo,\nsenza fretta"} italicFrom={1} className="font-display breathe text-[clamp(3rem,8vw,8rem)] leading-[0.9] mb-16" />
      {ev.length === 0 ? (
        <p className="font-display italic text-3xl text-bone-dim">Nuove date in arrivo — scrivimi per un concerto.</p>
      ) : (
        <div className="border-t border-white/10">
          {ev.map((e, i) => (
            <Reveal key={e.id} y={30} delay={i * 0.05}>
              <div className="group grid grid-cols-12 gap-4 items-center py-8 border-b border-white/10 relative overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-amber/10 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                <div className="col-span-4 md:col-span-2 relative">
                  <div className="font-display text-5xl md:text-6xl leading-none">{fmtDate(e.date, { day: "2-digit" })}</div>
                  <div className="label !text-[0.6rem] mt-1">{fmtDate(e.date, { month: "short", year: "numeric" })}</div>
                </div>
                <div className="col-span-8 md:col-span-5 relative">
                  <div className="font-display text-2xl md:text-3xl leading-tight">{e.title}</div>
                  <div className="text-bone-dim text-sm mt-1">{e.note}</div>
                </div>
                <div className="col-span-8 md:col-span-3 relative text-bone/80">
                  {e.venue} · <span className="text-bone-dim">{e.city}</span>
                  <div className="label !text-[0.58rem] !text-bone-dim mt-1">ore {e.time}</div>
                </div>
                <div className="col-span-4 md:col-span-2 relative text-right">
                  {e.ticketUrl ? (
                    <a href={e.ticketUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <span>Biglietti</span>
                    </a>
                  ) : (
                    <TLink to="/contatti" label="Contatti" className="btn btn-sm">
                      <span>Info</span>
                    </TLink>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────── FINAL CTA ───────────────────────────── */
function Finale() {
  const { data } = useSite();
  const c = data.content.cta;
  const sec = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(frame.current, { clipPath: "inset(14% 10% 14% 10% round 3rem)" }, { clipPath: "inset(0% 0% 0% 0% round 0rem)", ease: "none", scrollTrigger: { trigger: sec.current, start: "top 85%", end: "top 15%", scrub: true } });
      gsap.fromTo("[data-cimg]", { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: { trigger: sec.current, start: "top bottom", end: "bottom bottom", scrub: true } });
      ScrollTrigger.create({ trigger: sec.current, start: "top 50%", onEnter: () => setMood("copper"), onLeaveBack: () => setMood("amber") });
    }, sec.current!);
    return () => ctx.revert();
  }, []);
  return (
    <section ref={sec} className="relative min-h-screen grid place-items-center overflow-hidden px-6 md:px-14 py-32">
      <div ref={frame} className="absolute inset-0">
        <div data-cimg className="absolute inset-0 will-change-transform">
          <Img src={c.image} className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-ink/65" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(224,162,74,.2), transparent 60%), linear-gradient(to bottom, #0a0705, transparent 30%, transparent 70%, #0a0705)" }} />
      </div>
      <div className="relative z-10 text-center max-w-5xl">
        <div className="label mb-8">Ultimo brano</div>
        <MaskText as="h2" text={c.title} italicFrom={1} stagger={0.12} className="font-display breathe text-[clamp(3.4rem,11vw,10rem)] leading-[0.88]" />
        <Reveal delay={0.5} y={24}>
          <p className="mt-10 mx-auto max-w-xl text-bone/80 text-lg md:text-xl leading-relaxed">{c.text}</p>
          <div className="mt-12 flex flex-wrap gap-5 justify-center">
            <Btn solid to="/contatti" label="Contatti">
              {c.button}
            </Btn>
            <Btn to="/shop" label="Shop">
              Porta a casa il disco
            </Btn>
          </div>
          <a href={`mailto:${data.settings.bookingEmail}`} className="inline-block mt-10 label !text-bone-dim hover:!text-amber transition-colors">
            {data.settings.bookingEmail}
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { data } = useSite();
  return (
    <>
      <Hero />
      <Manifesto />
      <KeysScrub {...data.content.keys} />
      <Chapters />
      <Setlist />
      <Marquee />
      <Listen />
      <ShopTeaser />
      <Events />
      <Finale />
    </>
  );
}
