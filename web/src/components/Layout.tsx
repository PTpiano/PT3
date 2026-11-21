import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { gsap, TLink, getLenis } from "@/motion";
import { useCart, useSite, fmtTime } from "@/store/store";
import { usePlayer } from "@/audio/PlayerContext";
import { Img } from "./ui";
import Atmosphere from "./Atmosphere";
import CartDrawer from "./CartDrawer";
import Intro from "./Intro";

const LINKS = [
  { to: "/", label: "Ingresso" },
  { to: "/musica", label: "Musica" },
  { to: "/gallery", label: "Gallery" },
  { to: "/social", label: "Social" },
  { to: "/shop", label: "Shop" },
  { to: "/contatti", label: "Contatti" },
];

function Nav() {
  const { pathname } = useLocation();
  const { data } = useSite();
  const { items, setOpen } = useCart();
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const count = items.reduce((a, b) => a + b.qty, 0);

  useEffect(() => {
    let last = 0;
    const on = () => {
      const y = window.scrollY;
      setSolid(y > 40);
      setHidden(y > last && y > 400);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    const o = overlay.current!;
    if (menu) {
      getLenis()?.stop();
      gsap.to(o, { clipPath: "circle(150% at 95% 4%)", duration: 1, ease: "expo.inOut" });
      gsap.fromTo(o.querySelectorAll("[data-l]"), { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.07, delay: 0.35 });
    } else {
      getLenis()?.start();
      gsap.to(o, { clipPath: "circle(0% at 95% 4%)", duration: 0.8, ease: "expo.inOut" });
    }
  }, [menu]);
  useEffect(() => setMenu(false), [pathname]);

  return (
    <>
      <nav className={`fixed top-0 inset-x-0 z-[100] transition-all duration-700 ${hidden && !menu ? "-translate-y-full" : "translate-y-0"} ${solid ? "bg-ink/55 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="flex items-center justify-between px-6 md:px-14 py-5">
          <TLink to="/" label={data.settings.artistName.split(" ")[0]} className="font-display display-it text-2xl tracking-tight text-bone">
            {data.settings.artistName}
          </TLink>
          <div className="hidden lg:flex items-center gap-9">
            {LINKS.slice(1).map((l) => (
              <TLink key={l.to} to={l.to} label={l.label} className={`group relative label !text-[0.64rem] transition-colors ${pathname === l.to ? "!text-amber" : "!text-bone/80 hover:!text-amber"}`}>
                {l.label}
                <span className={`absolute -bottom-1.5 left-0 h-px bg-amber transition-all duration-700 ${pathname === l.to ? "w-full" : "w-0 group-hover:w-full"}`} />
              </TLink>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => setOpen(true)} className="label !text-bone/80 hover:!text-amber transition-colors" aria-label="Carrello">
              Carrello <span className="text-amber">[{count}]</span>
            </button>
            <button onClick={() => setMenu((m) => !m)} className="lg:hidden relative w-9 h-9" aria-label="Menu">
              <span className={`absolute left-1 right-1 h-px bg-bone transition-all duration-500 ${menu ? "top-1/2 rotate-45" : "top-3"}`} />
              <span className={`absolute left-1 right-1 h-px bg-bone transition-all duration-500 ${menu ? "top-1/2 -rotate-45" : "bottom-3"}`} />
            </button>
          </div>
        </div>
      </nav>

      <div ref={overlay} className="fixed inset-0 z-[99] bg-ink-2 flex flex-col justify-center px-8" style={{ clipPath: "circle(0% at 95% 4%)" }}>
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 80% 90%, rgba(181,101,29,.35), transparent 55%)" }} />
        {LINKS.map((l, i) => (
          <div key={l.to} className="overflow-hidden relative">
            <div data-l>
              <TLink to={l.to} label={l.label} className="flex items-baseline gap-5 py-2 font-display text-[clamp(2.6rem,12vw,5rem)] leading-none">
                <span className="label !text-[0.6rem]">0{i + 1}</span>
                <span className={pathname === l.to ? "display-it text-amber" : ""}>{l.label}</span>
              </TLink>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniPlayer() {
  const p = usePlayer();
  const { pathname } = useLocation();
  if (!p.current || pathname === "/musica") return null;
  const pct = p.duration ? (p.progress / p.duration) * 100 : 0;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-[26rem] z-[95] rounded-2xl border border-white/10 bg-ink/75 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="flex items-center gap-4 p-3">
        <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 ${p.playing ? "vinyl-spin" : ""}`} style={{ animationDuration: "5s" }}>
          <Img src={p.current.cover} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight truncate">{p.current.title}</div>
          <div className="label !text-[0.55rem] !text-bone-dim">
            {fmtTime(p.progress)} / {fmtTime(p.duration)}
          </div>
        </div>
        <button onClick={p.prev} className="text-bone-dim hover:text-amber transition" aria-label="Precedente">
          ⏮
        </button>
        <button onClick={p.toggle} className="w-10 h-10 rounded-full bg-amber text-ink grid place-items-center" aria-label="Play/Pausa">
          {p.playing ? "❚❚" : "▶"}
        </button>
        <button onClick={p.next} className="text-bone-dim hover:text-amber transition" aria-label="Successivo">
          ⏭
        </button>
      </div>
      <div className="h-[2px] bg-white/10">
        <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Footer() {
  const { data } = useSite();
  const s = data.settings;
  return (
    <footer className="relative z-10 border-t border-white/10 mt-24 px-6 md:px-14 pt-20 pb-28">
      <div className="grid md:grid-cols-12 gap-12">
        <div className="md:col-span-6">
          <div className="font-display display-it text-5xl md:text-7xl leading-none">{s.artistName}</div>
          <p className="mt-6 text-bone-dim max-w-md">{s.tagline}</p>
        </div>
        <div className="md:col-span-3 space-y-3">
          <div className="label mb-4">Esplora</div>
          {LINKS.map((l) => (
            <div key={l.to}>
              <TLink to={l.to} label={l.label} className="text-bone/80 hover:text-amber transition-colors">
                {l.label}
              </TLink>
            </div>
          ))}
        </div>
        <div className="md:col-span-3 space-y-3 text-bone/80">
          <div className="label mb-4">Booking</div>
          <a href={`mailto:${s.bookingEmail}`} className="block hover:text-amber transition-colors">
            {s.bookingEmail}
          </a>
          <div>{s.phone}</div>
          <div>{s.location}</div>
        </div>
      </div>
      <div className="mt-20 flex flex-wrap items-center justify-between gap-4 label !text-bone-dim !text-[0.6rem]">
        <span>
          © {new Date().getFullYear()} {s.artistName} — tutti i diritti riservati
        </span>
        <TLink to="/admin" className="hover:!text-amber">
          Area riservata
        </TLink>
      </div>
    </footer>
  );
}

function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar.current) bar.current.style.transform = `scaleY(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return (
    <div className="fixed right-0 top-0 bottom-0 w-[2px] z-[97] bg-white/5 pointer-events-none" aria-hidden>
      <div ref={bar} className="w-full h-full origin-top bg-amber" style={{ transform: "scaleY(0)", boxShadow: "0 0 12px var(--accent)" }} />
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="grain relative min-h-screen">
      <Intro />
      <Atmosphere />
      <ScrollProgress />
      <Nav />
      <main className="relative z-10">{children}</main>
      <Footer />
      <MiniPlayer />
      <CartDrawer />
    </div>
  );
}
