import { useRef, useState, type ReactNode } from "react";
import { ASSETS } from "@/assets";
import { GalleryThumbnail } from "@/components/video";
import { compressImage, putFile, useSrc } from "@/store/media";

export const inputCls = "w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-bone placeholder:text-bone-dim/40 outline-none focus:border-amber focus:ring-1 focus:ring-amber/40 transition";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-[0.14em] text-bone-dim mb-1.5 font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-bone-dim/60 mt-1.5">{hint}</span>}
    </label>
  );
}

export function TextInput({ label, value, onChange, type = "text", placeholder, hint, className }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} style={type === "date" ? { colorScheme: "dark" } : undefined} />
    </Field>
  );
}
export function NumberInput({ label, value, onChange, hint, step = 1, className }: { label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={inputCls} />
    </Field>
  );
}
export function TextArea({ label, value, onChange, rows = 4, hint, className }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + " resize-y"} />
    </Field>
  );
}
export function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[]; className?: string }) {
  return (
    <Field label={label} className={className}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v} className="bg-ink-2">
              {l}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <button type="button" onClick={() => onChange(!value)} role="switch" aria-checked={value} className={`mt-0.5 relative w-10 h-6 rounded-full transition ${value ? "bg-amber" : "bg-white/15"}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-ink transition-all ${value ? "left-5" : "left-1"}`} />
      </button>
      <div>
        <div className="text-sm text-bone">{label}</div>
        {hint && <div className="text-xs text-bone-dim/60">{hint}</div>}
      </div>
    </div>
  );
}

export function Btn({ children, onClick, tone = "default", small, disabled, type = "button", title }: { children: ReactNode; onClick?: () => void; tone?: "default" | "primary" | "danger" | "ghost"; small?: boolean; disabled?: boolean; type?: "button" | "submit"; title?: string }) {
  const t = {
    default: "border border-white/15 hover:border-amber hover:text-amber",
    primary: "bg-amber text-ink font-semibold hover:brightness-110",
    danger: "border border-red-400/30 text-red-300 hover:bg-red-500/15",
    ghost: "text-bone-dim hover:text-amber",
  }[tone];
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title} className={`rounded-lg transition disabled:opacity-40 ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"} ${t}`}>
      {children}
    </button>
  );
}

export function Card({ title, desc, children, actions }: { title?: string; desc?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 md:p-6">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && <h3 className="font-display text-xl text-bone">{title}</h3>}
            {desc && <p className="text-sm text-bone-dim mt-1 max-w-2xl">{desc}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PanelHead({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <h2 className="font-display text-3xl md:text-4xl text-bone">{title}</h2>
        {desc && <p className="text-bone-dim mt-1.5 max-w-2xl text-sm">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

/** image / audio / video: paste URL, upload a file (stored in IndexedDB) or pick built-in artwork */
export function MediaField({ label, value, onChange, kind = "image", hint }: { label: string; value?: string | null; onChange: (v: string) => void; kind?: "image" | "audio" | "video"; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  // I vecchi draft salvati nel browser possono contenere campi mancanti:
  // normalizziamo il valore per non interrompere l'intero pannello.
  const current = typeof value === "string" ? value : "";
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const blob = kind === "image" ? await compressImage(file) : file;
      onChange(await putFile(blob, file.name));
    } catch {
      setErr("Caricamento non riuscito (spazio del browser pieno?).");
    }
    setBusy(false);
  };
  const accept = kind === "image" ? "image/*" : kind === "audio" ? "audio/*" : "video/*";
  const isUpload = current.startsWith("idb:");
  const isAsset = current.startsWith("asset:");
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-3 items-start">
        {kind === "image" && <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/10"><GalleryThumbnail src={current} alt="" className="h-full w-full object-cover" /></div>}
        <div className="flex-1 min-w-0 space-y-2">
          <input value={isUpload ? "File caricato ✓" : isAsset ? `Incluso: ${current.slice(6)}` : current} readOnly={isUpload || isAsset} placeholder={kind === "image" ? "https://… oppure carica" : kind === "audio" ? "https://…/brano.mp3 oppure carica (vuoto = demo generativa)" : "https://…/video.mp4"} onChange={(e) => onChange(e.target.value)} className={inputCls} />
          <div className="flex flex-wrap gap-2 items-center">
            <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Btn small onClick={() => input.current?.click()} disabled={busy}>
              {busy ? "Carico…" : "Carica file"}
            </Btn>
            {kind === "image" && (
              <select value="" onChange={(e) => e.target.value && onChange("asset:" + e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-bone-dim">
                <option value="">Immagini incluse…</option>
                {Object.keys(ASSETS).map((k) => (
                  <option key={k} value={k} className="bg-ink-2">
                    {k}
                  </option>
                ))}
              </select>
            )}
            {current && (
              <Btn small tone="ghost" onClick={() => onChange("")}>
                Rimuovi
              </Btn>
            )}
          </div>
          {/* Drop zone: trascina qui il file */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void upload(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-lg border border-dashed px-3 py-2 text-center text-xs transition ${over ? "border-amber bg-amber/10 text-amber" : "border-white/15 text-bone-dim/70"}`}
          >
            {over ? "Rilascia per caricare" : "…oppure trascina qui il file"}
          </div>
          {err && <div className="text-xs text-red-300">{err}</div>}
        </div>
      </div>
    </Field>
  );
}

/**
 * Zona di drop multipla: accetta file audio (o immagini) e li passa a
 * `onFiles`. Usata per caricare interi album in una volta.
 */
export function DropZone({ label, hint, accept = "audio/*", multiple = true, onFiles, disabled, children }: { label: string; hint?: string; accept?: string; multiple?: boolean; onFiles: (files: File[]) => void; disabled?: boolean; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        // ignora il leave dei figli: si considera uscito solo se il
        // puntatore lascia davvero la zona
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        handle(e.dataTransfer.files);
      }}
      onClick={() => !disabled && input.current?.click()}
      className={`rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition ${disabled ? "opacity-40 pointer-events-none" : over ? "border-amber bg-amber/10" : "border-white/15 hover:border-amber/60 hover:bg-white/[0.02]"}`}
    >
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      <div className="text-sm text-bone">{label}</div>
      {hint && <div className="text-xs text-bone-dim/70 mt-1.5">{hint}</div>}
      {children}
    </div>
  );
}

/** Collapsible list editor: add, duplicate, reorder, delete */
export function ListEditor<T extends { id: string }>({ items, onChange, make, makeDuplicate, title, sub, render, addLabel, thumb, onDelete }: { items: T[]; onChange: (i: T[]) => void; make: () => T; makeDuplicate?: (item: T) => T; title: (i: T) => string; sub?: (i: T) => string; render: (i: T, patch: (p: Partial<T>) => void) => ReactNode; addLabel: string; thumb?: (i: T) => string | undefined; onDelete?: (i: T) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (i: number, d: number) => {
    const n = [...items];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  /**
   * Riordina con drop: sposta l'elemento trascinato nella posizione di
   * destinazione. L'id arriva dal dataTransfer: è più affidabile dello
   * stato React, che potrebbe non essere ancora aggiornato al momento
   * del drop (o quando il drag è più veloce del re-render).
   */
  const drop = (to: number, draggedId?: string) => {
    const from = draggedId ? items.findIndex((x) => x.id === draggedId) : drag;
    if (from === null || from < 0 || from === to) return;
    const n = [...items];
    const [moved] = n.splice(from, 1);
    n.splice(to, 0, moved);
    onChange(n);
    setDrag(null);
    setOver(null);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open === it.id;
        return (
          <div
            key={it.id}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
              // Firefox exige dati per far partire il drag
              e.dataTransfer.setData("text/plain", it.id);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== i) setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(i, e.dataTransfer.getData("text/plain") || undefined);
            }}
            className={`rounded-xl border transition ${isOpen ? "border-amber/40 bg-white/[0.03]" : "border-white/10 bg-white/[0.015]"} ${drag === i ? "opacity-40" : ""} ${over === i && drag !== null && drag !== i ? "border-amber ring-1 ring-amber/40" : ""}`}
          >
            <div className="flex items-center gap-3 p-3">
              <span className="cursor-grab active:cursor-grabbing text-bone-dim/50 select-none px-1" title="Trascina per riordinare" aria-hidden>
                ⠿
              </span>
              <button type="button" onClick={() => setOpen(isOpen ? null : it.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                {thumb && <Thumb src={thumb(it)} />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-bone truncate">{title(it) || "Senza titolo"}</span>
                  {sub && <span className="block text-xs text-bone-dim truncate">{sub(it)}</span>}
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <Btn small tone="ghost" onClick={() => move(i, -1)}>↑</Btn>
                <Btn small tone="ghost" onClick={() => move(i, 1)}>↓</Btn>
                <Btn small tone="ghost" onClick={() => onChange([...items.slice(0, i + 1), makeDuplicate ? makeDuplicate(it) : { ...it, id: make().id }, ...items.slice(i + 1)])}>⧉</Btn>
                <Btn
                  small
                  tone="danger"
                  onClick={() => {
                    if (onDelete) onDelete(it);
                    else if (confirm("Eliminare questo elemento?")) onChange(items.filter((x) => x.id !== it.id));
                  }}
                >
                  ✕
                </Btn>
                <Btn small tone="ghost" onClick={() => setOpen(isOpen ? null : it.id)}>{isOpen ? "▲" : "▼"}</Btn>
              </div>
            </div>
            {isOpen && <div className="p-4 pt-2 border-t border-white/10 grid gap-4">{render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}</div>}
          </div>
        );
      })}
      <Btn
        onClick={() => {
          const n = make();
          onChange([...items, n]);
          setOpen(n.id);
        }}
      >
        + {addLabel}
      </Btn>
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  const s = useSrc(src);
  return <span className="w-10 h-10 shrink-0 rounded-md bg-black/40 overflow-hidden border border-white/10">{s && <img src={s} alt="" className="w-full h-full object-cover" />}</span>;
}
