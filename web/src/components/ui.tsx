import type { ReactNode } from "react";
import { useSrc } from "@/store/media";
import { MaskText, Magnetic, TLink, Reveal } from "@/motion";

export function Img({ src, alt = "", className = "", style, draggable = false }: { src?: string; alt?: string; className?: string; style?: React.CSSProperties; draggable?: boolean }) {
  const s = useSrc(src);
  if (!s) return <div className={className} style={{ background: "linear-gradient(135deg,#2a1a10,#0a0705)", ...style }} />;
  return <img src={s} alt={alt} className={className} style={style} draggable={draggable} loading="lazy" decoding="async" />;
}

export function PageHero({ kicker, title, sub, children }: { kicker: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="relative px-6 md:px-14 pt-40 md:pt-52 pb-16 md:pb-24 z-10">
      <Reveal y={20}>
        <div className="label mb-8 flex items-center gap-4">
          <span className="inline-block w-12 h-px bg-amber" />
          {kicker}
        </div>
      </Reveal>
      <MaskText as="h1" text={title} className="font-display breathe text-[clamp(3.2rem,11vw,10.5rem)] leading-[0.88] tracking-tight" italicFrom={1} />
      {sub && (
        <Reveal delay={0.35} y={24} className="mt-10 max-w-2xl text-bone-dim text-lg md:text-xl leading-relaxed">
          {sub}
        </Reveal>
      )}
      {children}
    </header>
  );
}

export function Btn({ children, to, href, onClick, solid, small, label, type = "button", disabled, className = "" }: { children: ReactNode; to?: string; href?: string; onClick?: () => void; solid?: boolean; small?: boolean; label?: string; type?: "button" | "submit"; disabled?: boolean; className?: string }) {
  const cls = `btn ${solid ? "btn-solid" : ""} ${small ? "btn-sm" : ""} ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
    </>
  );
  return (
    <Magnetic strength={0.28}>
      {to ? (
        <TLink to={to} label={label} className={cls}>
          {inner}
        </TLink>
      ) : href ? (
        <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
          {inner}
        </a>
      ) : (
        <button type={type} onClick={onClick} className={cls} disabled={disabled}>
          {inner}
        </button>
      )}
    </Magnetic>
  );
}

export function SmokeDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 h-[30vh] z-20"
      style={{
        [flip ? "bottom" : "top"]: 0,
        background: `linear-gradient(${flip ? "to top" : "to bottom"}, #0a0705 0%, rgba(10,7,5,.85) 25%, rgba(10,7,5,0) 100%)`,
      }}
    />
  );
}

export function Stave({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} data-stave className="h-px w-full bg-amber/30 origin-left" style={{ marginTop: i ? 14 : 0 }} />
      ))}
    </div>
  );
}

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("it-IT", opts ?? { day: "2-digit", month: "short", year: "numeric" });
