import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
export const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isCoarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** True only for the very first visit of the session on the home route (drives the opening sequence). */
export const introFlag = {
  pending: typeof window !== "undefined" && !sessionStorage.getItem("nocturne.intro") && (!location.hash || location.hash === "#/") && !prefersReduced(),
};

/* ----------------------------- smooth scroll ----------------------------- */
let lenisRef: Lenis | null = null;
export const getLenis = () => lenisRef;

export function SmoothScroll({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const lenis = new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenisRef = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef = null;
    };
  }, [pathname.startsWith("/admin")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0);
    lenisRef?.scrollTo(0, { immediate: true });
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    const t2 = setTimeout(() => ScrollTrigger.refresh(), 1600); // after fonts / images settle
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [pathname]);

  return <>{children}</>;
}

/* ------------------------------ page transition ------------------------------ */
const TransCtx = createContext<(to: string, label?: string) => void>(() => {});
export const useGo = () => useContext(TransCtx);

export function TransitionProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const veil = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [label, setLabel] = useState("");

  const go = (to: string, lab = "") => {
    const cur = loc.pathname + loc.search;
    if (busy.current || to === cur) return;
    if (prefersReduced()) return nav(to);
    busy.current = true;
    setLabel(lab);
    lenisRef?.stop();
    const tl = gsap.timeline({
      onComplete: () => {
        busy.current = false;
      },
    });
    tl.set(veil.current, { pointerEvents: "all" })
      .fromTo(veil.current, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.85, ease: "expo.inOut" })
      .fromTo(word.current, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out" }, "-=0.35")
      .add(() => {
        nav(to);
        window.scrollTo(0, 0);
      })
      .to({}, { duration: 0.45 })
      .to(word.current, { yPercent: -110, opacity: 0, duration: 0.6, ease: "expo.in" })
      .to(veil.current, { clipPath: "inset(0 0 100% 0)", duration: 0.95, ease: "expo.inOut" }, "-=0.3")
      .set(veil.current, { pointerEvents: "none" })
      .add(() => lenisRef?.start());
  };

  return (
    <TransCtx.Provider value={go}>
      {children}
      <div
        ref={veil}
        className="fixed inset-0 z-[9000] pointer-events-none grid place-items-center bg-ink"
        style={{ clipPath: "inset(100% 0 0 0)" }}
        aria-hidden
      >
        <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(181,101,29,.35), transparent 60%)" }} />
        <div className="overflow-hidden">
          <div ref={word} className="font-display display-it text-[clamp(3rem,10vw,9rem)] text-oxide opacity-0">
            {label}
          </div>
        </div>
      </div>
    </TransCtx.Provider>
  );
}

/** Internal link that plays the smoky curtain transition */
export function TLink({ to, label, className, children, onClick, ...rest }: { to: string; label?: string; className?: string; children: ReactNode; onClick?: () => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const go = useGo();
  return (
    <a
      {...rest}
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onClick?.();
        go(to, label);
      }}
    >
      {children}
    </a>
  );
}

/* ------------------------------ mask text reveal ------------------------------ */
export function MaskText({
  text,
  as: Tag = "div",
  className = "",
  delay = 0,
  stagger = 0.08,
  start = "top 90%",
  italicFrom,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  start?: string;
  italicFrom?: number; // line index from which words are italic
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const parts = el.querySelectorAll("[data-m]");
    if (prefersReduced()) {
      gsap.set(parts, { yPercent: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(parts, { yPercent: 118, rotate: 4, transformOrigin: "0% 100%" });
      ScrollTrigger.create({
        trigger: el,
        start,
        once: true,
        onEnter: () => gsap.to(parts, { yPercent: 0, rotate: 0, duration: 1.6, ease: "expo.out", stagger, delay }),
      });
    }, el);
    return () => ctx.revert();
  }, [text, start, stagger, delay]);

  return (
    <Tag ref={ref} className={className} aria-label={text.replace(/\n/g, " ")}>
      {text.split("\n").map((line, li) => (
        <span key={li} className={`block ${italicFrom !== undefined && li >= italicFrom ? "display-it" : ""}`} aria-hidden>
          {line.split(" ").map((w, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: "0.14em", marginBottom: "-0.14em" }}>
              <span data-m className="inline-block will-change-transform">
                {w}
                {"\u00A0"}
              </span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/* ------------------------------ generic reveal ------------------------------ */
export function Reveal({
  children,
  className = "",
  y = 40,
  delay = 0,
  clip = false,
  stagger = 0,
  start = "top 88%",
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  clip?: boolean;
  stagger?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current!;
    const targets = stagger ? Array.from(el.children) : [el];
    const ctx = gsap.context(() => {
      gsap.set(targets, { y, opacity: 0, ...(clip ? { clipPath: "inset(0 0 100% 0)" } : {}) });
      ScrollTrigger.create({
        trigger: el,
        start,
        once: true,
        onEnter: () =>
          gsap.to(targets, {
            y: 0,
            opacity: 1,
            ...(clip ? { clipPath: "inset(0 0 0% 0)" } : {}),
            duration: 1.5,
            ease: "expo.out",
            delay,
            stagger,
            onComplete: () => void (clip && gsap.set(targets, { clearProps: "clipPath" })),
          }),
      });
    }, el);
    return () => ctx.revert();
  }, [y, delay, clip, stagger, start]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ------------------------------ parallax layer ------------------------------ */
export function Parallax({ children, speed = 0.2, className = "", style }: { children: ReactNode; speed?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current!;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: -speed * 50 },
        { yPercent: speed * 50, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
      );
    }, el);
    return () => ctx.revert();
  }, [speed]);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------ magnetic wrapper ------------------------------ */
export function Magnetic({ children, strength = 0.35, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCoarse()) return;
    const el = ref.current!;
    const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, [strength]);
  return (
    <div ref={ref} className={`inline-block ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------ custom cursor ------------------------------ */
export function Cursor() {
  const glow = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const trails = useRef<HTMLDivElement[]>([]);
  const [label, setLabel] = useState("");
  const enabled = typeof window !== "undefined" && !isCoarse();

  useEffect(() => {
    if (!enabled) return;
    document.body.classList.add("has-cursor");
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const pts = trails.current.map(() => ({ x: pos.x, y: pos.y }));
    const rp = { x: pos.x, y: pos.y };
    const gp = { x: pos.x, y: pos.y };
    const move = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      gsap.set(dot.current, { x: pos.x, y: pos.y });
    };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const c = t.closest?.("[data-cursor]") as HTMLElement | null;
      const h = t.closest?.("a,button,input,select,textarea,label,[role=button]");
      ring.current?.classList.toggle("label-on", !!c?.dataset.cursor);
      ring.current?.classList.toggle("hover", !!h && !c?.dataset.cursor);
      setLabel(c?.dataset.cursor || "");
    };
    const tick = () => {
      rp.x += (pos.x - rp.x) * 0.18;
      rp.y += (pos.y - rp.y) * 0.18;
      gp.x += (pos.x - gp.x) * 0.06;
      gp.y += (pos.y - gp.y) * 0.06;
      gsap.set(ring.current, { x: rp.x, y: rp.y });
      gsap.set(glow.current, { x: gp.x, y: gp.y });
      let px = rp.x,
        py = rp.y;
      pts.forEach((p, i) => {
        p.x += (px - p.x) * (0.32 - i * 0.03);
        p.y += (py - p.y) * (0.32 - i * 0.03);
        const el = trails.current[i];
        if (el) {
          el.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${1 - i * 0.14})`;
          el.style.opacity = String(0.42 - i * 0.07);
        }
        px = p.x;
        py = p.y;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    gsap.ticker.add(tick);
    return () => {
      document.body.classList.remove("has-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      gsap.ticker.remove(tick);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div ref={glow} className="cursor-glow" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} ref={(el) => void (el && (trails.current[i] = el))} className="cursor-trail" />
      ))}
      <div ref={ring} className="cursor-ring">
        {label}
      </div>
      <div ref={dot} className="cursor-dot" />
    </>
  );
}

/* ------------------------------ atmosphere mood ------------------------------ */
export type Mood = "amber" | "indigo" | "green" | "copper";
export const atmo = { mood: "amber" as Mood, energy: 0 };
export const setMood = (m: Mood) => {
  atmo.mood = m;
};
