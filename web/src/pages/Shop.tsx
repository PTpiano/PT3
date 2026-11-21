import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { setMood, Reveal, gsap } from "@/motion";
import { useCart, useSite, fmtMoney, isPhysical } from "@/store/store";
import type { Product } from "@/store/data";
import { Img, PageHero, Btn } from "@/components/ui";
import { usePlayer } from "@/audio/PlayerContext";

const KIND_ICON: Record<string, string> = { digital: "MP3", flac: "FLAC", cd: "CD", vinyl: "LP", cassette: "MC" };

function ProductModal({ p, onClose }: { p: Product; onClose: () => void }) {
  const { data } = useSite();
  const cart = useCart();
  const player = usePlayer();
  const cur = data.settings.currency;
  // Solo i formati attivi sono acquistabili: il pannello admin decide
  // quali offerte esistono davvero.
  const sellable = p.formats.filter((f) => f.enabled !== false);
  const [fid, setFid] = useState(sellable[0]?.id);
  const f = sellable.find((x) => x.id === fid) ?? sellable[0];
  const [amount, setAmount] = useState<string>(String(f?.price ?? 0));
  const [added, setAdded] = useState(false);
  useEffect(() => setAmount(String(f?.price ?? 0)), [fid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    gsap.fromTo("#pm", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" });
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  if (!f) return null;
  const val = Math.max(f.pwyw ? f.min : f.price, parseFloat(amount.replace(",", ".")) || 0);
  const soldOut = f.stock !== null && f.stock <= 0;
  const tracks = p.trackIds.map((id) => data.tracks.find((t) => t.id === id)).filter(Boolean);

  const add = () => {
    cart.add({ productId: p.id, formatId: f.id, qty: 1, price: f.pwyw ? val : f.price });
    setAdded(true);
    setTimeout(() => {
      onClose();
      cart.setOpen(true);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md overflow-y-auto" onClick={onClose} data-lenis-prevent>
      <div id="pm" onClick={(e) => e.stopPropagation()} className="relative max-w-5xl mx-auto my-6 md:my-16 bg-ink-2 border border-white/10 rounded-3xl overflow-hidden grid md:grid-cols-2">
        <button onClick={onClose} className="absolute top-5 right-5 z-10 label hover:!text-bone">
          Chiudi ✕
        </button>
        <div className="relative aspect-square md:aspect-auto">
          <Img src={p.cover} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-2 via-transparent to-transparent md:bg-gradient-to-r" />
        </div>
        <div className="p-7 md:p-10">
          <div className="label mb-3">
            {p.type} · {p.year}
          </div>
          <h3 className="font-display text-4xl md:text-5xl leading-none mb-5">{p.title}</h3>
          <p className="text-bone/75 leading-relaxed mb-6">{p.description}</p>

          {tracks.length > 0 && (
            <div className="mb-7">
              <div className="label !text-[0.58rem] mb-2">Anteprima</div>
              {tracks.map((t) => (
                <button key={t!.id} onClick={() => { player.setTracklist(p.trackIds); player.play(t!.id); }} className="w-full flex items-center gap-3 py-2 border-b border-white/10 text-left hover:text-amber transition">
                  <span className="w-7 h-7 rounded-full border border-white/20 grid place-items-center text-[10px]">{player.current?.id === t!.id && player.playing ? "❚❚" : "▶"}</span>
                  <span className="font-display text-lg">{t!.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="label !text-[0.58rem] mb-3">Formato</div>
          <div className="grid gap-2 mb-6">
            {sellable.map((x) => {
              const out = x.stock !== null && x.stock <= 0;
              return (
                <button key={x.id} disabled={out} onClick={() => setFid(x.id)} className={`flex items-center gap-4 text-left border rounded-xl px-4 py-3 transition ${fid === x.id ? "border-amber bg-amber/10" : "border-white/10 hover:border-white/30"} ${out ? "opacity-40" : ""}`}>
                  <span className="label !text-[0.6rem] w-11">{KIND_ICON[x.kind]}</span>
                  <span className="flex-1 text-sm">
                    {x.label}
                    {x.stock !== null && x.stock > 0 && x.stock < 30 && <span className="text-amber"> · ultime {x.stock}</span>}
                    {out && " · esaurito"}
                  </span>
                  <span className="font-display text-lg">{x.pwyw ? "Libera" : fmtMoney(x.price, cur)}</span>
                </button>
              );
            })}
          </div>

          {f.pwyw && (
            <div className="mb-6 rounded-xl border border-amber/30 bg-amber/5 p-4">
              <div className="label !text-[0.58rem] mb-2">Offerta libera{f.min === 0 ? " — anche 0" : ` — minimo ${fmtMoney(f.min, cur)}`}</div>
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl text-amber">{cur}</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className="field !text-3xl !py-1 flex-1" aria-label="Importo" />
              </div>
              <div className="flex gap-2 mt-3">
                {[0, f.price, f.price * 2, f.price * 3].filter((v, i, a) => a.indexOf(v) === i && v >= f.min).map((v) => (
                  <button key={v} onClick={() => setAmount(String(v))} className="label !text-[0.58rem] border border-white/15 rounded-full px-3 py-1.5 hover:border-amber">
                    {v === 0 ? "Gratis" : fmtMoney(v, cur)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-bone-dim mt-3">Il download è sempre disponibile: paga ciò che vuoi, sostieni la musica.</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="font-display text-4xl">{(f.pwyw ? val : f.price) === 0 ? "Gratis" : fmtMoney(f.pwyw ? val : f.price, cur)}</div>
            <Btn solid onClick={add} disabled={soldOut}>
              {added ? "Aggiunto ✓" : soldOut ? "Esaurito" : (f.pwyw ? val : f.price) === 0 ? "Ottieni gratis" : isPhysical(f.kind) ? "Aggiungi al carrello" : "Acquista download"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Shop() {
  const { data } = useSite();
  const { search } = useLocation();
  const [type, setType] = useState("tutti");
  const [open, setOpen] = useState<Product | null>(null);
  useEffect(() => setMood("indigo"), []);
  const list = useMemo(() => data.products.filter((p) => p.published && (type === "tutti" || p.type === type)), [data.products, type]);
  const cur = data.settings.currency;

  // La CTA "Porta a casa il disco" arriva con l'id del prodotto: lo shop
  // apre direttamente la scheda del disco scelto.
  useEffect(() => {
    const wanted = new URLSearchParams(search).get("album");
    if (!wanted) return;
    const product = data.products.find((item) => item.id === wanted && item.published);
    if (product) setOpen(product);
  }, [data.products, search]);

  return (
    <>
      <PageHero kicker="Shop" title={"Porta a casa\nla serata"} sub="Album e compilation in digitale (a offerta libera, anche zero), CD, vinile e musicassetta. Spedizioni curate, tirature limitate." />
      <section className="relative px-6 md:px-14 pb-32">
        <div className="flex flex-wrap gap-3 mb-12">
          {["tutti", "album", "compilation", "single"].map((t) => (
            <button key={t} onClick={() => setType(t)} className={`label !text-[0.62rem] px-5 py-2.5 rounded-full border transition-all duration-500 ${type === t ? "bg-amber !text-ink border-amber" : "border-white/15 hover:border-amber"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {list.map((p, i) => {
            // Solo i formati attivi: un formato disattivato dall'admin
            // non è un'acquisto disponibile.
            const sellable = p.formats.filter((f) => f.enabled !== false);
            const min = sellable.length ? Math.min(...sellable.map((f) => (f.pwyw ? f.min : f.price))) : 0;
            return (
              <Reveal key={p.id} y={60} delay={(i % 3) * 0.1}>
                <button onClick={() => setOpen(p)} className="group text-left w-full" data-cursor="Scopri">
                  <div className="relative aspect-square">
                    <div className="absolute inset-[4%] rounded-full vinyl-grooves translate-x-0 group-hover:translate-x-[22%] transition-transform duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] shadow-xl shadow-black">
                      <div className="absolute inset-[34%] rounded-full overflow-hidden">
                        <Img src={p.cover} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="absolute inset-0 w-[92%] rounded-md overflow-hidden shadow-2xl shadow-black group-hover:-translate-x-[3%] group-hover:-rotate-1 transition-transform duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)]">
                      <Img src={p.cover} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10" />
                    </div>
                  </div>
                  <div className="mt-7 flex items-start justify-between gap-4">
                    <div>
                      <div className="label !text-[0.58rem] mb-2">
                        {p.type} · {p.year}
                      </div>
                      <div className="font-display text-3xl leading-tight">{p.title}</div>
                    </div>
                    <div className="font-display text-xl text-amber whitespace-nowrap">{!sellable.length ? "—" : min === 0 ? "Libera" : `da ${fmtMoney(min, cur)}`}</div>
                  </div>
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {sellable.map((f) => (
                      <span key={f.id} className="label !text-[0.55rem] !text-bone-dim border border-white/10 rounded-full px-2.5 py-1">
                        {KIND_ICON[f.kind]}
                      </span>
                    ))}
                  </div>
                </button>
              </Reveal>
            );
          })}
        </div>
        {list.length === 0 && <p className="font-display italic text-3xl text-bone-dim">Nessun prodotto disponibile.</p>}

        <div className="mt-28 grid md:grid-cols-3 gap-8 border-t border-white/10 pt-12 text-bone-dim">
          {[
            ["Digitale a offerta libera", "Scegli tu l'importo, anche zero. Download immediato."],
            ["Spedizioni", `${cur}${data.settings.shippingFee} in Italia · gratis oltre ${cur}${data.settings.freeShippingOver}.`],
            ["Edizioni limitate", "Vinili numerati, musicassette e digipak a tiratura ridotta."],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="font-display text-2xl text-bone mb-2">{t}</div>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      {open && createPortal(<ProductModal p={open} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}
