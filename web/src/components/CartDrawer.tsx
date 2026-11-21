import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, getLenis } from "@/motion";
import { useCart, useSite, fmtMoney, findFormat, isPhysical } from "@/store/store";
import { uid, type Order } from "@/store/data";
import { resolveAsync } from "@/store/media";
import { Img } from "./ui";

function DownloadBtn({ url, name }: { url: string; name: string }) {
  const [href, setHref] = useState("");
  useEffect(() => {
    resolveAsync(url).then(setHref);
  }, [url]);
  if (!href) return null;
  return (
    <a href={href} download={name} target="_blank" rel="noreferrer" className="btn btn-sm btn-solid">
      Scarica · {name}
    </a>
  );
}

export default function CartDrawer() {
  const { data, update } = useSite();
  const cart = useCart();
  const { settings: s } = data;
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [done, setDone] = useState<Order | null>(null);
  const [form, setForm] = useState({ name: "", email: "", address: "", notes: "", method: "richiesta", consent: false });
  const [err, setErr] = useState("");

  const lines = useMemo(
    () =>
      cart.items
        .map((i) => {
          const r = findFormat(data.products, i.productId, i.formatId);
          return r ? { ...i, p: r.p, f: r.f } : null;
        })
        .filter(Boolean) as (typeof cart.items[number] & { p: NonNullable<ReturnType<typeof findFormat>>["p"]; f: NonNullable<ReturnType<typeof findFormat>>["f"] })[],
    [cart.items, data.products]
  );
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const physical = lines.some((l) => isPhysical(l.f.kind));
  const shipping = physical && subtotal < s.freeShippingOver ? s.shippingFee : 0;
  const total = subtotal + shipping;
  const free = total === 0;

  const wasOpen = useRef(false);
  useEffect(() => {
    const open = cart.open;
    if (open) {
      getLenis()?.stop();
      document.body.style.overflow = "hidden";
    } else if (wasOpen.current) {
      getLenis()?.start();
      document.body.style.overflow = "";
    }
    wasOpen.current = open;
    gsap.to(panel.current, { xPercent: open ? 0 : 105, duration: 0.9, ease: "expo.inOut" });
    gsap.to(back.current, { opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", duration: 0.6 });
    if (!open) setTimeout(() => step === "done" && (setStep("cart"), setDone(null)), 900);
  }, [cart.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.consent) return setErr("Accetta il trattamento dei dati per procedere.");
    if (physical && form.address.trim().length < 8) return setErr("Inserisci un indirizzo di spedizione completo.");
    // stock check
    for (const l of lines) if (l.f.stock !== null && l.qty > l.f.stock) return setErr(`"${l.p.title}" — ${l.f.label}: disponibili solo ${l.f.stock} copie.`);
    const method = free ? "gratuito" : form.method;
    const order: Order = {
      id: "ORD-" + uid("").slice(1, 7).toUpperCase(),
      date: new Date().toISOString(),
      name: form.name,
      email: form.email,
      address: form.address,
      notes: form.notes,
      lines: lines.map((l) => ({ productId: l.p.id, formatId: l.f.id, title: l.p.title, label: l.f.label, kind: l.f.kind, qty: l.qty, unit: l.price, file: l.f.file || l.p.downloadUrl || undefined })),
      shipping,
      total,
      method,
      status: free ? "pagato" : "nuovo",
    };
    update((d) => ({
      ...d,
      orders: [order, ...d.orders],
      products: d.products.map((p) => ({
        ...p,
        formats: p.formats.map((f) => {
          const l = lines.find((x) => x.p.id === p.id && x.f.id === f.id);
          return l && f.stock !== null ? { ...f, stock: Math.max(0, f.stock - l.qty) } : f;
        }),
      })),
    }));
    if (s.formEndpoint) {
      fetch(s.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: `Nuovo ordine ${order.id} — ${fmtMoney(total, s.currency)}`, ordine: order.id, nome: form.name, email: form.email, indirizzo: form.address, note: form.notes, metodo: method, totale: total, righe: order.lines.map((l) => `${l.qty}x ${l.title} (${l.label}) @ ${l.unit}`).join(" | ") }),
      }).catch(() => {});
    }
    setDone(order);
    setStep("done");
    cart.clear();
    if (method === "paypal" && s.paypalMe) window.open(`https://paypal.me/${s.paypalMe.replace(/^.*paypal\.me\//, "")}/${total.toFixed(2)}EUR`, "_blank");
    if (method === "stripe" && s.stripeLink) window.open(`${s.stripeLink}${s.stripeLink.includes("?") ? "&" : "?"}client_reference_id=${order.id}&prefilled_email=${encodeURIComponent(form.email)}`, "_blank");
    // optional: single-product payment links
    if (method === "carta" && lines.length === 1 && lines[0].p.paymentLink) window.open(lines[0].p.paymentLink, "_blank");
  };

  const methods = [
    ...(s.paypalMe ? [{ v: "paypal", l: "PayPal" }] : []),
    ...(s.stripeLink ? [{ v: "stripe", l: "Carta (Stripe)" }] : []),
    { v: "richiesta", l: "Bonifico / pagamento su richiesta" },
  ];

  return (
    <>
      <div ref={back} onClick={() => cart.setOpen(false)} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm opacity-0 pointer-events-none" />
      <aside ref={panel} className="fixed top-0 right-0 bottom-0 z-[201] w-full max-w-lg bg-ink-2 border-l border-white/10 flex flex-col" style={{ transform: "translateX(105%)" }} data-lenis-prevent>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="font-display display-it text-3xl">{step === "done" ? "Grazie" : step === "checkout" ? "Checkout" : "Il tuo carrello"}</div>
          <button onClick={() => cart.setOpen(false)} className="label hover:!text-bone" aria-label="Chiudi">
            Chiudi ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "cart" &&
            (lines.length === 0 ? (
              <p className="text-bone-dim font-display italic text-2xl mt-10">Il carrello è vuoto — come una sala prima del primo brano.</p>
            ) : (
              <div className="space-y-5">
                {lines.map((l) => (
                  <div key={l.p.id + l.f.id} className="flex gap-4 pb-5 border-b border-white/10">
                    <Img src={l.p.cover} className="w-20 h-20 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-xl leading-tight">{l.p.title}</div>
                      <div className="text-xs text-bone-dim mt-1">{l.f.label}</div>
                      <div className="flex items-center gap-3 mt-3">
                        {!isPhysical(l.f.kind) ? (
                          <span className="label !text-[0.58rem]">Download</span>
                        ) : (
                          <div className="flex items-center border border-white/15 rounded-full">
                            <button className="w-7 h-7" onClick={() => cart.setQty(l.p.id, l.f.id, l.qty - 1)}>
                              −
                            </button>
                            <span className="w-6 text-center text-sm">{l.qty}</span>
                            <button className="w-7 h-7" onClick={() => cart.setQty(l.p.id, l.f.id, l.qty + 1)}>
                              +
                            </button>
                          </div>
                        )}
                        <button className="label !text-[0.58rem] !text-bone-dim hover:!text-amber" onClick={() => cart.remove(l.p.id, l.f.id)}>
                          Rimuovi
                        </button>
                      </div>
                    </div>
                    <div className="font-display text-xl">{l.price === 0 ? "Gratis" : fmtMoney(l.price * l.qty, s.currency)}</div>
                  </div>
                ))}
              </div>
            ))}

          {step === "checkout" && (
            <form id="checkout" onSubmit={place} className="space-y-6">
              <input required className="field !text-lg" placeholder="Nome e cognome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input required type="email" className="field !text-lg" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {physical && <textarea className="field !text-lg" rows={3} placeholder="Indirizzo di spedizione completo" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}
              <input className="field !text-lg" placeholder="Note (facoltativo)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              {!free && (
                <div>
                  <div className="label mb-3">Metodo di pagamento</div>
                  <div className="space-y-2">
                    {methods.map((m) => (
                      <label key={m.v} className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition ${form.method === m.v ? "border-amber bg-amber/10" : "border-white/10"}`}>
                        <input type="radio" name="m" checked={form.method === m.v} onChange={() => setForm({ ...form, method: m.v })} className="accent-amber" />
                        {m.l}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-bone-dim mt-3">{s.paymentNote}</p>
                </div>
              )}
              <label className="flex items-start gap-3 text-sm text-bone-dim">
                <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1 accent-amber" />
                Acconsento al trattamento dei miei dati per la gestione dell'ordine.
              </label>
              {err && <div className="text-sm text-red-300">{err}</div>}
            </form>
          )}

          {step === "done" && done && (
            <div className="space-y-6">
              <div className="label">Ordine {done.id}</div>
              <p className="font-display text-3xl leading-snug">{done.total === 0 ? "La tua musica è pronta. Buon ascolto." : "Ordine ricevuto. Ti scriveremo a breve."}</p>
              <p className="text-bone-dim">
                Riepilogo inviato a <span className="text-bone">{done.email}</span>. {done.total > 0 && s.paymentNote}
              </p>
              {done.total === 0 && (
                <div className="flex flex-col gap-3 items-start">
                  {done.lines
                    .filter((l) => !isPhysical(l.kind))
                    .map((l) => {
                      const p = data.products.find((x) => x.id === l.productId);
                      // Il file può stare sul formato scelto (MP3 vs FLAC)
                      // oppure sul prodotto: si preferisce il formato.
                      const file = l.file || p?.downloadUrl;
                      return file ? <DownloadBtn key={l.productId + l.formatId} url={file} name={p?.title ?? l.title} /> : <div key={l.productId + l.formatId} className="text-sm text-bone-dim">Il link di download di «{l.title}» arriverà via email.</div>;
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {step !== "done" && lines.length > 0 && (
          <div className="p-6 border-t border-white/10 space-y-4 bg-ink">
            <div className="flex justify-between text-sm text-bone-dim">
              <span>Subtotale</span>
              <span>{fmtMoney(subtotal, s.currency)}</span>
            </div>
            {physical && (
              <div className="flex justify-between text-sm text-bone-dim">
                <span>Spedizione {shipping === 0 && `(gratis oltre ${s.currency}${s.freeShippingOver})`}</span>
                <span>{fmtMoney(shipping, s.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-3xl">
              <span>Totale</span>
              <span>{free ? "Gratis" : fmtMoney(total, s.currency)}</span>
            </div>
            {step === "cart" ? (
              <button className="btn btn-solid w-full justify-center" onClick={() => setStep("checkout")}>
                <span>{free ? "Ricevi gratis" : "Procedi al checkout"}</span>
              </button>
            ) : (
              <div className="flex gap-3">
                <button className="btn flex-none" onClick={() => setStep("cart")}>
                  <span>←</span>
                </button>
                <button type="submit" form="checkout" className="btn btn-solid flex-1 justify-center">
                  <span>{free ? "Conferma e scarica" : "Conferma ordine"}</span>
                </button>
              </div>
            )}
          </div>
        )}
        {step === "done" && (
          <div className="p-6 border-t border-white/10">
            <button className="btn w-full justify-center" onClick={() => cart.setOpen(false)}>
              <span>Torna alla sala</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
