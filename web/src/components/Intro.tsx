import { useEffect, useRef, useState } from "react";
import { gsap, introFlag, getLenis } from "@/motion";
import { useSite } from "@/store/store";

/** One-time opening sequence: a stave line draws, the name surfaces, then the "lid" lifts. */
export default function Intro() {
  const { data } = useSite();
  const [done, setDone] = useState(!introFlag.pending);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const el = root.current!;
    document.body.style.overflow = "hidden";
    const freeze = gsap.delayedCall(0.05, () => getLenis()?.stop());
    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = "";
        getLenis()?.start();
        sessionStorage.setItem("nocturne.intro", "1");
        introFlag.pending = false;
        setDone(true);
      },
    });
    tl.fromTo("[data-line]", { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: "expo.inOut" })
      .fromTo("[data-lamp]", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 1.4, ease: "expo.out" }, 0.2)
      .fromTo("[data-word]", { yPercent: 115 }, { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.12 }, 0.7)
      .fromTo("[data-sub]", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.2 }, 1.2)
      .to({}, { duration: 0.6 })
      .to("[data-word],[data-sub]", { opacity: 0, y: -20, duration: 0.6, ease: "power2.in" })
      .to("[data-line],[data-lamp]", { opacity: 0, duration: 0.5 }, "<")
      .to("[data-top]", { yPercent: -100, duration: 1.5, ease: "expo.inOut" }, "-=0.1")
      .to("[data-bot]", { yPercent: 100, duration: 1.5, ease: "expo.inOut" }, "<");
    return () => {
      tl.kill();
      freeze.kill();
      getLenis()?.start();
      document.body.style.overflow = "";
      void el;
    };
  }, [done]);

  if (done) return null;
  const words = data.settings.artistName.split(" ");
  return (
    <div ref={root} className="fixed inset-0 z-[9500] pointer-events-all" aria-hidden>
      <div data-top className="absolute inset-x-0 top-0 h-1/2 bg-ink" />
      <div data-bot className="absolute inset-x-0 bottom-0 h-1/2 bg-ink" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div data-lamp className="mx-auto mb-8 w-3 h-3 rounded-full bg-amber" style={{ boxShadow: "0 0 40px 12px rgba(224,162,74,.55)" }} />
          <div className="flex gap-[0.3em] justify-center font-display display-it text-[clamp(2.6rem,9vw,7rem)] leading-none">
            {words.map((w, i) => (
              <span key={i} className="overflow-hidden inline-block pb-[0.12em]">
                <span data-word className="inline-block">
                  {w}
                </span>
              </span>
            ))}
          </div>
          <div data-sub className="label mt-6 !text-bone-dim">
            Sala d'ascolto · si entra in silenzio
          </div>
        </div>
      </div>
      <div data-line className="absolute left-[8%] right-[8%] top-1/2 h-px bg-amber/70 origin-center" />
    </div>
  );
}
