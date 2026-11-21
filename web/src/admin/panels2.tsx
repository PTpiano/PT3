import { useEffect, useState } from "react";
import { useSite, fmtMoney, fmtTime } from "@/store/store";
import { uid, type Order, type Product, type Track, type Format } from "@/store/data";
import { putFile } from "@/store/media";
import { deleteProduct, formatSummary, pullFromServer, saveProduct, useAdminSession } from "@/store/sync";
import { fmtDate } from "@/components/ui";
import { Btn, Card, DropZone, ListEditor, MediaField, NumberInput, PanelHead, Select, TextArea, TextInput, Toggle } from "./ui";

/** Etichette di default per i nuovi formati. */
const FORMAT_LABEL: Record<Format["kind"], string> = {
  digital: "Download digitale (MP3 320)",
  flac: "Download lossless (FLAC 24 bit)",
  cd: "CD",
  vinyl: "Vinile",
  cassette: "Musicassetta",
};

/* ─────────────── Brani ─────────────── */
export function TracksPanel() {
  const { data, update } = useSite();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  /** Carica più file audio in una volta: un brano per file. */
  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setMsg("");
    const added: Track[] = [];
    for (const f of files) {
      try {
        added.push({
          id: uid("t"),
          title: f.name.replace(/\.[^.]+$/, ""),
          subtitle: "",
          durationSec: 0,
          cover: "asset:cover1",
          audio: await putFile(f, f.name),
          story: "",
          year: String(new Date().getFullYear()),
          mood: "",
          published: true,
        });
      } catch {
        /* file non leggibile: prossimo */
      }
    }
    update((d) => ({ ...d, tracks: [...d.tracks, ...added] }));
    setBusy(false);
    setMsg(`${added.length} brani caricati. Ora puoi inserirli in un album dalla sezione Shop.`);
  };

  return (
    <>
      <PanelHead title="Brani" desc="Carica i master (MP3/WAV/OGG): vengono salvati nel browser di questo dispositivo. Per un sito pubblico incolla invece l'URL di un file ospitato (CDN, S3, Bandcamp…). Senza file il brano suona come demo generativa." />

      <div className="mb-6">
        <DropZone
          label="Trascina qui i file audio"
          hint="Più brani in una volta: MP3, WAV, FLAC, M4A, OGG. Ogni file crea un brano nella lista."
          accept="audio/*"
          disabled={busy}
          onFiles={(files) => void addFiles(files)}
        />
        {msg && <p className="text-xs text-emerald-300 mt-2">{msg}</p>}
      </div>

      <ListEditor items={data.tracks} onChange={(v) => update((d) => ({ ...d, tracks: v }))} addLabel="Nuovo brano" thumb={(t) => t.cover}
        make={(): Track => ({ id: uid("t"), title: "Nuovo brano", subtitle: "", durationSec: 240, cover: "asset:cover1", audio: "", story: "", year: String(new Date().getFullYear()), mood: "", published: true })}
        title={(t) => t.title} sub={(t) => `${t.subtitle || "—"} · ${fmtTime(t.durationSec)}${t.audio ? " · audio ✓" : " · demo"}${t.published ? "" : " · bozza"}`}
        render={(t, p) => (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <TextInput label="Titolo" value={t.title} onChange={(v) => p({ title: v })} />
              <TextInput label="Album / raccolta" value={t.subtitle} onChange={(v) => p({ subtitle: v })} />
              <TextInput label="Anno" value={t.year} onChange={(v) => p({ year: v })} />
              <TextInput label="Mood / scala / bpm" value={t.mood} onChange={(v) => p({ mood: v })} />
              <NumberInput label="Durata (secondi)" value={t.durationSec} onChange={(v) => p({ durationSec: v })} hint="Per i file caricati viene letta automaticamente; serve per la demo." />
            </div>
            <TextArea label="Storia del brano" rows={2} value={t.story} onChange={(v) => p({ story: v })} />
            <MediaField label="Copertina" value={t.cover} onChange={(v) => p({ cover: v })} />
            <MediaField kind="audio" label="File audio" value={t.audio} onChange={(v) => p({ audio: v })} />
            <Toggle label="Pubblicato" value={t.published} onChange={(v) => p({ published: v })} />
          </>
        )}
      />
    </>
  );
}

/* ─────────────── Prodotti ─────────────── */
export function ProductsPanel() {
  const { data, update } = useSite();
  const session = useAdminSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragTrack, setDragTrack] = useState<string | null>(null);
  const [overTrack, setOverTrack] = useState<string | null>(null);

  const online = !!session;

  /** Importa dal database gli album già pubblicati (e li abbina a quelli locali). */
  const sync = async () => {
    setBusy("sync");
    setMsg(null);
    const res = await pullFromServer(data.products, data.tracks);
    setBusy(null);
    if (!res.ok || !res.products || !res.tracks) {
      setMsg({ ok: false, text: res.error ?? "Sincronizzazione fallita." });
      return;
    }
    update((d) => ({ ...d, products: res.products!, tracks: res.tracks! }));
    setMsg({ ok: true, text: "Album sincronizzati con il database." });
  };

  // Appena collegati, porta dentro gli album già presenti nel database.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      const res = await pullFromServer(data.products, data.tracks);
      if (!alive || !res.ok || !res.products || !res.tracks) return;
      update((d) => ({ ...d, products: res.products!, tracks: res.tracks! }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  /** Salva l'album nel database (crea o aggiorna). */
  const save = async (p: Product) => {
    setBusy(p.id);
    setMsg(null);
    const res = await saveProduct(p, data.tracks);
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error ?? "Salvataggio fallito." });
      return;
    }
    // Memorizza l'id del DB: i prossimi salvataggi aggiornano, non creano.
    if (res.id && res.id !== p.dbId) {
      update((d) => ({
        ...d,
        products: d.products.map((x) => (x.id === p.id ? { ...x, dbId: res.id } : x)),
      }));
    }
    setMsg({ ok: true, text: `«${p.title}» salvato nel database.` });
  };

  const remove = async (p: Product) => {
    if (!p.dbId) {
      update((d) => ({ ...d, products: d.products.filter((x) => x.id !== p.id) }));
      return;
    }
    if (!confirm(`Eliminare «${p.title}» dal database?`)) return;
    setBusy(p.id);
    const res = await deleteProduct(p.dbId);
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error ?? "Eliminazione fallita." });
      return;
    }
    update((d) => ({ ...d, products: d.products.filter((x) => x.id !== p.id) }));
    setMsg({ ok: true, text: `«${p.title}» eliminato dal database.` });
  };

  /**
   * Carica file audio dentro un album: crea un brano per ciascun file e
   * lo aggiunge in coda alla tracklist.
   */
  const dropTracksInto = async (p: Product, files: File[]) => {
    if (!files.length) return;
    setBusy(p.id);
    const added: Track[] = [];
    for (const f of files) {
      try {
        added.push({
          id: uid("t"),
          title: f.name.replace(/\.[^.]+$/, ""),
          subtitle: p.title,
          durationSec: 0,
          cover: p.cover || "asset:cover1",
          audio: await putFile(f, f.name),
          story: "",
          year: p.year,
          mood: "",
          published: true,
        });
      } catch {
        /* file non leggibile: prossimo */
      }
    }
    update((d) => ({
      ...d,
      tracks: [...d.tracks, ...added],
      products: d.products.map((x) =>
        x.id === p.id ? { ...x, trackIds: [...x.trackIds, ...added.map((a) => a.id)] } : x
      ),
    }));
    setBusy(null);
    setMsg({ ok: true, text: `${added.length} brani aggiunti a «${p.title}».` });
  };

  /** Riordina la tracklist spostando il brano trascinato. */
  const reorder = (p: Product, fromId: string, toId: string) => {
    if (fromId === toId) return;
    update((d) => ({
      ...d,
      products: d.products.map((x) => {
        if (x.id !== p.id) return x;
        const ids = [...x.trackIds];
        const from = ids.indexOf(fromId);
        const to = ids.indexOf(toId);
        if (from < 0 || to < 0) return x;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        return { ...x, trackIds: ids };
      }),
    }));
  };

  return (
    <>
      <PanelHead
        title="Shop · prodotti"
        desc="Album, compilation e singoli. Trascina i file audio per creare i brani, scegli in quali formati vendere l'album e salvala nel database."
        actions={
          online ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-300">● Collegato al database</span>
              <Btn small tone="ghost" onClick={() => void sync()} disabled={busy === "sync"}>
                {busy === "sync" ? "Sincronizzo…" : "Sincronizza col database"}
              </Btn>
            </div>
          ) : (
            <span className="text-xs text-amber">○ Solo locale — accedi al server per salvare</span>
          )
        }
      />

      {msg && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
          {msg.text}
        </div>
      )}

      <ListEditor items={data.products} onChange={(v) => update((d) => ({ ...d, products: v }))} addLabel="Nuovo prodotto" thumb={(p) => p.cover}
        make={(): Product => ({
          id: uid("pr"),
          title: "Nuovo disco",
          type: "album",
          year: String(new Date().getFullYear()),
          cover: "asset:cover1",
          description: "",
          trackIds: [],
          formats: [{ id: uid("f"), kind: "digital", label: FORMAT_LABEL.digital, price: 7, pwyw: true, min: 0, stock: null, enabled: true, file: "" }],
          downloadUrl: "",
          paymentLink: "",
          featured: false,
          published: true,
        })}
        title={(p) => p.title}
        sub={(p) => `${p.type} · ${p.formats.filter((f) => f.enabled !== false).length}/${p.formats.length} formati · ${p.trackIds.length} brani${p.featured ? " · in evidenza" : ""}${p.published ? "" : " · bozza"}${p.dbId ? " · su DB" : ""}`}
        render={(p, patch) => {
          const albumTracks = p.trackIds.map((id) => data.tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
          return (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <TextInput className="md:col-span-2" label="Titolo" value={p.title} onChange={(v) => patch({ title: v })} />
                <TextInput label="Anno" value={p.year} onChange={(v) => patch({ year: v })} />
                <Select label="Tipo" value={p.type} onChange={(v) => patch({ type: v as typeof p.type })} options={["album", "compilation", "single"]} />
              </div>
              <TextArea label="Descrizione" rows={3} value={p.description} onChange={(v) => patch({ description: v })} />
              <MediaField label="Copertina" value={p.cover} onChange={(v) => patch({ cover: v })} />

              {/* ── Brani: drag & drop ── */}
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-bone-dim mb-2">
                  Brani dell&apos;album ({albumTracks.length})
                </div>

                <DropZone
                  label="Trascina qui i file audio"
                  hint="Ogni file diventa un brano, in coda alla tracklist. MP3, WAV, FLAC, M4A."
                  accept="audio/*"
                  disabled={busy === p.id}
                  onFiles={(files) => void dropTracksInto(p, files)}
                />

                {albumTracks.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {albumTracks.map((t, i) => (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          // stopPropagation: senza, il drag sale al
                          // ListEditor che sovrascrive il dataTransfer con
                          // l'id del prodotto e il riordino non funziona.
                          e.stopPropagation();
                          setDragTrack(t.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("application/x-track-id", t.id);
                          e.dataTransfer.setData("text/plain", t.id);
                        }}
                        onDragEnd={() => {
                          setDragTrack(null);
                          setOverTrack(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          if (overTrack !== t.id) setOverTrack(t.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // L'id arriva nel dataTransfer: è più affidabile
                          // dello stato, che potrebbe non essere ancora
                          // aggiornato al momento del drop.
                          const from = e.dataTransfer.getData("application/x-track-id") || dragTrack;
                          if (from) reorder(p, from, t.id);
                          setDragTrack(null);
                          setOverTrack(null);
                        }}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${dragTrack === t.id ? "opacity-40" : ""} ${overTrack === t.id && dragTrack !== t.id ? "border-amber bg-amber/5" : "border-white/10 bg-black/20"}`}
                      >
                        <span className="cursor-grab active:cursor-grabbing text-bone-dim/50 select-none" title="Trascina per riordinare" aria-hidden>⠿</span>
                        <span className="font-mono text-xs text-amber w-6">{i + 1}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{t.title}</span>
                          <span className="block text-xs text-bone-dim">
                            {fmtTime(t.durationSec)} · {t.audio ? "audio ✓" : "demo generativa"}
                          </span>
                        </span>
                        <Btn small tone="ghost" onClick={() => patch({ trackIds: p.trackIds.filter((x) => x !== t.id) })} title="Togli dal brano">
                          ✕
                        </Btn>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Brani disponibili non ancora nell'album */}
                {(() => {
                  const free = data.tracks.filter((t) => !p.trackIds.includes(t.id));
                  if (!free.length) return null;
                  return (
                    <details className="mt-3">
                      <summary className="text-xs text-bone-dim cursor-pointer hover:text-amber">
                        Aggiungi brani già esistenti ({free.length})
                      </summary>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {free.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => patch({ trackIds: [...p.trackIds, t.id] })}
                            className="text-xs rounded-full px-3 py-1.5 border border-white/15 text-bone-dim hover:border-amber hover:text-amber"
                          >
                            + {t.title}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })()}
              </div>

              {/* ── Formati: cosa vendere e a che prezzo ── */}
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-bone-dim mb-2">
                  Formati e prezzi
                </div>
                <div className="space-y-3">
                  {p.formats.map((f, i) => {
                    const pf = (x: Partial<typeof f>) => patch({ formats: p.formats.map((y, j) => (j === i ? { ...y, ...x } : y)) });
                    const off = f.enabled === false;
                    return (
                      <div key={f.id} className={`rounded-xl border p-4 grid md:grid-cols-6 gap-3 items-end ${off ? "border-white/5 bg-black/10 opacity-60" : "border-white/10 bg-black/20"}`}>
                        <Select className="md:col-span-1" label="Tipo" value={f.kind} onChange={(v) => pf({ kind: v as typeof f.kind, label: FORMAT_LABEL[v as typeof f.kind] })} options={["digital", "flac", "cd", "vinyl", "cassette"]} />
                        <TextInput className="md:col-span-2" label="Etichetta" value={f.label} onChange={(v) => pf({ label: v })} />
                        <NumberInput className="md:col-span-1" label={f.pwyw ? "Prezzo suggerito" : "Prezzo"} step={0.5} value={f.price} onChange={(v) => pf({ price: v, ...(f.pwyw ? {} : { min: v }) })} />
                        <NumberInput className="md:col-span-1" label="Stock (-1 = ∞)" value={f.stock ?? -1} onChange={(v) => pf({ stock: v < 0 ? null : v })} />
                        <div className="md:col-span-1 text-right">
                          <Btn small tone="danger" onClick={() => patch({ formats: p.formats.filter((_, j) => j !== i) })}>
                            Elimina
                          </Btn>
                        </div>
                        <div className="md:col-span-5 flex flex-wrap gap-6 items-center">
                          <Toggle label="In vendita nello shop" value={f.enabled !== false} onChange={(v) => pf({ enabled: v })} hint="Disattivato = non compare tra i formati acquistabili." />
                          {f.pwyw && <NumberInput label="Minimo" step={0.5} value={f.min} onChange={(v) => pf({ min: Math.max(0, v) })} />}
                        </div>
                        {(f.kind === "digital" || f.kind === "flac") && (
                          <div className="md:col-span-6">
                            <MediaField kind="audio" label="File consegnato al cliente" value={f.file} onChange={(v) => pf({ file: v })} hint="MP3 o ZIP per il download digitale, FLAC per la versione lossless." />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <Btn small onClick={() => patch({ formats: [...p.formats, { id: uid("f"), kind: "cd", label: FORMAT_LABEL.cd, price: 14, pwyw: false, min: 14, stock: 100, enabled: true, file: "" }] })}>
                    + Aggiungi formato
                  </Btn>
                </div>
                <p className="text-xs text-bone-dim/70 mt-2">
                  {p.formats.filter((f) => f.enabled !== false).length} formato/i attivo/i:{" "}
                  {p.formats.filter((f) => f.enabled !== false).map((f) => `${f.kind} (${formatSummary(f)})`).join(" · ") || "nessuno"}
                </p>
              </div>

              <div className="flex gap-8 flex-wrap">
                <Toggle label="In evidenza in home" value={p.featured} onChange={(v) => patch({ featured: v })} />
                <Toggle label="Pubblicato" value={p.published} onChange={(v) => patch({ published: v })} hint="Bozza = visibile solo in admin, nascosto ai visitatori." />
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
                <Btn tone="primary" onClick={() => void save(p)} disabled={busy === p.id || !online}>
                  {busy === p.id ? "Salvo…" : p.dbId ? "Aggiorna nel database" : "Crea nel database"}
                </Btn>
                {p.dbId && (
                  <Btn tone="danger" onClick={() => void remove(p)} disabled={busy === p.id}>
                    Elimina dal database
                  </Btn>
                )}
                {!online && <span className="text-xs text-bone-dim self-center">Accedi al server dal pannello Impostazioni per salvare.</span>}
              </div>
            </>
          );
        }}
      />
    </>
  );
}

/* ─────────────── Ordini ─────────────── */
const STATUS: Order["status"][] = ["nuovo", "pagato", "spedito", "annullato"];
const stCls: Record<string, string> = { nuovo: "bg-amber/15 text-amber", pagato: "bg-emerald-500/15 text-emerald-300", spedito: "bg-sky-500/15 text-sky-300", annullato: "bg-red-500/15 text-red-300" };

export function OrdersPanel() {
  const { data, update } = useSite();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const cur = data.settings.currency;
  const list = data.orders.filter((o) => !q || (o.id + o.name + o.email).toLowerCase().includes(q.toLowerCase()));
  const csv = () => {
    const rows = [["id", "data", "nome", "email", "totale", "metodo", "stato", "righe"], ...data.orders.map((o) => [o.id, o.date, o.name, o.email, o.total, o.method, o.status, o.lines.map((l) => `${l.qty}x ${l.title} (${l.label})`).join(" | ")])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ordini.csv";
    a.click();
  };
  return (
    <>
      <PanelHead title="Ordini" desc="Tutti gli ordini ricevuti dallo shop. Aggiorna lo stato dopo l'incasso e la spedizione." actions={<Btn onClick={csv}>Esporta CSV</Btn>} />
      <div className="mb-5 max-w-sm">
        <TextInput label="Cerca" value={q} onChange={setQ} placeholder="Numero, nome, email…" />
      </div>
      {list.length === 0 ? (
        <Card>
          <p className="text-bone-dim text-sm">Nessun ordine.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <div key={o.id} className="rounded-xl border border-white/10 bg-white/[0.02]">
              <button onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full flex flex-wrap items-center gap-4 p-4 text-left">
                <span className="font-mono text-sm text-amber">{o.id}</span>
                <span className="flex-1 min-w-[10rem]">
                  <span className="block text-sm">{o.name}</span>
                  <span className="block text-xs text-bone-dim">{o.email}</span>
                </span>
                <span className="text-xs text-bone-dim">{fmtDate(o.date)}</span>
                <span className="font-display text-xl">{o.total === 0 ? "Gratis" : fmtMoney(o.total, cur)}</span>
                <span className={`text-xs rounded-full px-3 py-1 ${stCls[o.status]}`}>{o.status}</span>
              </button>
              {open === o.id && (
                <div className="border-t border-white/10 p-4 grid md:grid-cols-2 gap-6 text-sm">
                  <div>
                    {o.lines.map((l, i) => (
                      <div key={i} className="flex justify-between py-1.5 border-b border-white/5">
                        <span>
                          {l.qty}× {l.title} <span className="text-bone-dim">— {l.label}</span>
                        </span>
                        <span>{fmtMoney(l.unit * l.qty, cur)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 text-bone-dim">
                      <span>Spedizione</span>
                      <span>{fmtMoney(o.shipping, cur)}</span>
                    </div>
                    <div className="mt-2 text-bone-dim">Metodo: {o.method}</div>
                  </div>
                  <div className="space-y-3">
                    {o.address && (
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-bone-dim">Indirizzo</div>
                        <div className="whitespace-pre-line">{o.address}</div>
                      </div>
                    )}
                    {o.notes && (
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-bone-dim">Note</div>
                        {o.notes}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-center pt-2">
                      {STATUS.map((s) => (
                        <Btn key={s} small tone={o.status === s ? "primary" : "default"} onClick={() => update((d) => ({ ...d, orders: d.orders.map((x) => (x.id === o.id ? { ...x, status: s } : x)) }))}>
                          {s}
                        </Btn>
                      ))}
                      <a className="text-xs text-amber underline ml-2" href={`mailto:${o.email}?subject=${encodeURIComponent("Il tuo ordine " + o.id)}`}>
                        Scrivi al cliente
                      </a>
                      <Btn small tone="danger" onClick={() => confirm("Eliminare l'ordine?") && update((d) => ({ ...d, orders: d.orders.filter((x) => x.id !== o.id) }))}>
                        Elimina
                      </Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
