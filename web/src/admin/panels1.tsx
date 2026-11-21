import { useSite, fmtMoney } from "@/store/store";
import { uid } from "@/store/data";
import { fmtDate } from "@/components/ui";
import { Card, ListEditor, MediaField, PanelHead, TextArea, TextInput, Btn } from "./ui";

/* ─────────────── Dashboard ─────────────── */
export function Dashboard({ go }: { go: (t: string) => void }) {
  const { data } = useSite();
  const cur = data.settings.currency;
  const valid = data.orders.filter((o) => o.status !== "annullato");
  const revenue = valid.filter((o) => o.status !== "nuovo").reduce((a, o) => a + o.total, 0);
  const pending = data.orders.filter((o) => o.status === "nuovo").length;
  const unread = data.messages.filter((m) => !m.read).length;

  const stats = [
    { l: "Incassato", v: fmtMoney(revenue, cur), s: `${valid.length} ordini totali`, t: "orders" },
    { l: "Ordini da gestire", v: String(pending), s: "in attesa di pagamento / spedizione", t: "orders" },
    { l: "Messaggi non letti", v: String(unread), s: `${data.messages.length} ricevuti`, t: "messages" },
    { l: "Brani pubblicati", v: String(data.tracks.filter((t) => t.published).length), s: `${data.tracks.length} totali`, t: "tracks" },
    { l: "Prodotti shop", v: String(data.products.filter((t) => t.published).length), s: `${data.products.length} totali`, t: "products" },
    { l: "Foto in gallery", v: String(data.gallery.filter((t) => t.published).length), s: `${data.gallery.length} totali`, t: "gallery" },
  ];

  const s = data.settings;
  const checks = [
    { ok: s.adminPassword !== "taglieri2025", t: "Cambia la password admin predefinita", to: "settings" },
    { ok: !!s.formEndpoint, t: "Collega il form contatti a un servizio email (es. Formspree)", to: "settings" },
    { ok: !!(s.paypalMe || s.stripeLink), t: "Configura un metodo di pagamento (PayPal.me o Stripe Payment Link)", to: "settings" },
    { ok: data.tracks.some((t) => !!t.audio), t: "Carica i master audio dei brani (ora suonano come demo generative)", to: "tracks" },
    { ok: !!(data.api.youtubeKey || data.api.instagramToken || data.api.feedUrl), t: "Collega le API social per il feed live", to: "social" },
    { ok: data.products.every((p) => p.formats.every((f) => f.kind !== "digital" || !!p.downloadUrl)), t: "Aggiungi i file di download ai prodotti digitali", to: "products" },
  ];

  return (
    <>
      <PanelHead title="Dashboard" desc="Una visione d'insieme del tuo sito: ordini, messaggi e cosa manca per andare in produzione." />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {stats.map((x) => (
          <button key={x.l} onClick={() => go(x.t)} className="text-left rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:border-amber/50 transition group">
            <div className="text-[11px] uppercase tracking-[0.14em] text-bone-dim">{x.l}</div>
            <div className="font-display text-4xl mt-2 group-hover:text-amber transition">{x.v}</div>
            <div className="text-xs text-bone-dim/70 mt-1">{x.s}</div>
          </button>
        ))}
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Checklist produzione" desc="Completa questi punti prima del lancio.">
          <ul className="space-y-3">
            {checks.map((c) => (
              <li key={c.t} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 w-5 h-5 rounded-full grid place-items-center text-[11px] shrink-0 ${c.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-amber/20 text-amber"}`}>{c.ok ? "✓" : "!"}</span>
                <span className={`flex-1 ${c.ok ? "text-bone-dim line-through decoration-white/20" : "text-bone"}`}>{c.t}</span>
                {!c.ok && (
                  <Btn small tone="ghost" onClick={() => go(c.to)}>
                    Vai →
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Ultima attività">
          <div className="space-y-3">
            {[...data.orders.slice(0, 3).map((o) => ({ d: o.date, t: `Ordine ${o.id} · ${o.name}`, s: fmtMoney(o.total, cur), to: "orders" })), ...data.messages.slice(0, 3).map((m) => ({ d: m.date, t: `${m.name} — ${m.topic}`, s: m.read ? "letto" : "nuovo", to: "messages" }))]
              .sort((a, b) => +new Date(b.d) - +new Date(a.d))
              .map((x, i) => (
                <button key={i} onClick={() => go(x.to)} className="w-full flex justify-between gap-4 text-left text-sm border-b border-white/10 pb-3 hover:text-amber transition">
                  <span className="truncate">{x.t}</span>
                  <span className="text-bone-dim shrink-0">{x.s} · {fmtDate(x.d, { day: "2-digit", month: "short" })}</span>
                </button>
              ))}
            {data.orders.length + data.messages.length === 0 && <p className="text-sm text-bone-dim">Ancora nessuna attività. Gli ordini e i messaggi del sito compariranno qui.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}

/* ─────────────── Home & contenuti ─────────────── */
export function HomeContent() {
  const { data, update } = useSite();
  const c = data.content;
  const set = (fn: (c: typeof data.content) => typeof data.content) => update((d) => ({ ...d, content: fn(d.content) }));
  return (
    <>
      <PanelHead title="Home & contenuti" desc="Tutti i testi e le immagini delle sezioni narrative della home page." />
      <div className="grid gap-6">
        <Card title="Hero · ingresso">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="Kicker" value={c.hero.kicker} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, kicker: v } }))} />
            <TextInput label="Tagline" value={c.hero.tagline} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, tagline: v } }))} />
            <TextInput label="Titolo — riga 1" value={c.hero.line1} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, line1: v } }))} />
            <TextInput label="Titolo — riga 2 (corsivo)" value={c.hero.line2} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, line2: v } }))} />
            <TextInput label="Indicatore di scroll" value={c.hero.cta1} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, cta1: v } }))} />
            <TextInput label="Pulsante" value={c.hero.cta2} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, cta2: v } }))} />
          </div>
          <div className="mt-4">
            <MediaField label="Immagine di sfondo" value={c.hero.image} onChange={(v) => set((x) => ({ ...x, hero: { ...x.hero, image: v } }))} />
          </div>
        </Card>

        <Card title="Manifesto" desc="Il testo che si svela parola per parola durante lo scroll.">
          <TextArea label="Testo" rows={5} value={c.manifesto} onChange={(v) => set((x) => ({ ...x, manifesto: v }))} />
        </Card>

        <Card title="Sequenza tastiera (scroll-scrubbing)" desc="Se carichi un video MP4 (consigliato: H.264, tutti i frame keyframe, 1080p) la sezione lo scorre frame-by-frame con lo scroll. Senza video usa la tastiera animata e l'immagine.">
          <div className="grid gap-4">
            <TextInput label="Kicker" value={c.keys.kicker} onChange={(v) => set((x) => ({ ...x, keys: { ...x.keys, kicker: v } }))} />
            {c.keys.captions.map((cap, i) => (
              <TextInput key={i} label={`Frase ${i + 1}`} value={cap} onChange={(v) => set((x) => ({ ...x, keys: { ...x.keys, captions: x.keys.captions.map((y, j) => (j === i ? v : y)) } }))} />
            ))}
            <MediaField label="Immagine di sfondo" value={c.keys.image} onChange={(v) => set((x) => ({ ...x, keys: { ...x.keys, image: v } }))} />
            <MediaField kind="video" label="Video da scrubbare (opzionale)" value={c.keys.videoUrl} onChange={(v) => set((x) => ({ ...x, keys: { ...x.keys, videoUrl: v } }))} />
          </div>
        </Card>

        <Card title="Capitoli (biografia a strati)" desc="Sezione bloccata: ogni capitolo si rivela sopra il precedente.">
          <ListEditor items={c.chapters} onChange={(v) => set((x) => ({ ...x, chapters: v }))} addLabel="Aggiungi capitolo" make={() => ({ id: uid("c"), num: "V", title: "Nuovo capitolo", text: "", image: "asset:club" })} title={(i) => `${i.num}. ${i.title}`} thumb={(i) => i.image}
            render={(i, p) => (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <TextInput label="Numero" value={i.num} onChange={(v) => p({ num: v })} />
                  <TextInput className="col-span-3" label="Titolo" value={i.title} onChange={(v) => p({ title: v })} />
                </div>
                <TextArea label="Testo" value={i.text} onChange={(v) => p({ text: v })} />
                <MediaField label="Immagine" value={i.image} onChange={(v) => p({ image: v })} />
              </>
            )}
          />
        </Card>

        <Card title="Progetti (setlist orizzontale)">
          <ListEditor items={c.projects} onChange={(v) => set((x) => ({ ...x, projects: v }))} addLabel="Aggiungi progetto" make={() => ({ id: uid("p"), num: "V", title: "Nuovo progetto", year: String(new Date().getFullYear()), tag: "Album", text: "", image: "asset:cover1" })} title={(i) => `${i.num}. ${i.title}`} sub={(i) => `${i.tag} · ${i.year}`} thumb={(i) => i.image}
            render={(i, p) => (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <TextInput label="N." value={i.num} onChange={(v) => p({ num: v })} />
                  <TextInput className="col-span-2" label="Titolo" value={i.title} onChange={(v) => p({ title: v })} />
                  <TextInput label="Anno" value={i.year} onChange={(v) => p({ year: v })} />
                </div>
                <TextInput label="Etichetta" value={i.tag} onChange={(v) => p({ tag: v })} />
                <TextArea label="Descrizione" value={i.text} onChange={(v) => p({ text: v })} />
                <MediaField label="Immagine" value={i.image} onChange={(v) => p({ image: v })} />
              </>
            )}
          />
        </Card>

        <Card title="Marquee" desc="Parole che scorrono tra le sezioni (separate da virgola).">
          <TextInput label="Parole" value={c.marquee.join(", ")} onChange={(v) => set((x) => ({ ...x, marquee: v.split(",").map((s) => s.trim()).filter(Boolean) }))} />
        </Card>

        <Card title="Chiamata finale e bio">
          <div className="grid gap-4">
            <TextArea label="Titolo finale (usa invio per andare a capo)" rows={2} value={c.cta.title} onChange={(v) => set((x) => ({ ...x, cta: { ...x.cta, title: v } }))} />
            <TextArea label="Testo" rows={3} value={c.cta.text} onChange={(v) => set((x) => ({ ...x, cta: { ...x.cta, text: v } }))} />
            <TextInput label="Testo pulsante" value={c.cta.button} onChange={(v) => set((x) => ({ ...x, cta: { ...x.cta, button: v } }))} />
            <MediaField label="Immagine di sfondo finale" value={c.cta.image} onChange={(v) => set((x) => ({ ...x, cta: { ...x.cta, image: v } }))} />
            <hr className="border-white/10" />
            <TextInput label="Bio — titolo (pagina Contatti)" value={c.about.title} onChange={(v) => set((x) => ({ ...x, about: { ...x.about, title: v } }))} />
            <TextArea label="Bio — testo" value={c.about.text} onChange={(v) => set((x) => ({ ...x, about: { ...x.about, text: v } }))} />
            <MediaField label="Bio — ritratto" value={c.about.image} onChange={(v) => set((x) => ({ ...x, about: { ...x.about, image: v } }))} />
          </div>
        </Card>
      </div>
    </>
  );
}
