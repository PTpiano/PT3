import { useEffect, useRef, useState } from "react";
import { useSite } from "@/store/store";
import { uid, type SiteData, type GalleryItem } from "@/store/data";
import { clearFiles, compressImage, exportBackup, exportPublish, importBackup, putFile } from "@/store/media";
import { deleteGalleryItem, login, logout, pullGalleryFromServer, saveGalleryItem, useAdminSession } from "@/store/sync";
import { thumbnailForVideoUrl } from "@/store/video";
import { GalleryThumbnail } from "@/components/video";
import { fmtDate } from "@/components/ui";
import { Btn, Card, ListEditor, MediaField, NumberInput, PanelHead, Select, TextArea, TextInput, Toggle } from "./ui";

/* ─────────────── Connessione al database ─────────────── */
function ServerConnection() {
  const session = useAdminSession();
  const [email, setEmail] = useState(session?.email ?? "");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            Collegato come <strong>{session.email}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn
            onClick={() => {
              logout();
              setMsg("Disconnesso.");
            }}
          >
            Disconnetti
          </Btn>
        </div>
        {msg && <p className="text-xs text-bone-dim">{msg}</p>}
        <p className="text-xs text-bone-dim/70">
          Ora puoi creare e aggiornare album e contenuti della gallery direttamente nel database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <TextInput label="Email admin" value={email} onChange={setEmail} type="email" placeholder="admin@peppetaglieri.com" />
        <TextInput label="Password" value={pw} onChange={setPw} type="password" placeholder="••••••••" />
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Btn
          tone="primary"
          disabled={busy || !email || !pw}
          onClick={async () => {
            setBusy(true);
            setMsg("");
            const res = await login(email, pw);
            setBusy(false);
            setPw("");
            if (!res.ok) {
              setMsg(res.error ?? "Accesso non riuscito.");
              return;
            }
            setMsg("Collegato. Ricarica la pagina per vedere lo stato aggiornato.");
          }}
        >
          {busy ? "Accesso…" : "Collegati"}
        </Btn>
        {msg && <span className={`text-sm ${msg.includes("Collegato") ? "text-emerald-300" : "text-red-300"}`}>{msg}</span>}
      </div>
      <p className="text-xs text-bone-dim/70">
        Le credenziali sono quelle configurate sul server (ADMIN_EMAIL / ADMIN_PASSWORD). Vengono scambiate per un token JWT: la password non viene salvata nel browser.
      </p>
    </div>
  );
}

/* ─────────────── Gallery ─────────────── */

/** Campi video con rilevamento automatico della miniatura. */
function GalleryVideoFields({
  item,
  patch,
  disabled,
}: {
  item: GalleryItem;
  patch: (p: Partial<GalleryItem>) => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const generateThumbnail = async () => {
    const url = (item.videoUrl || "").trim();
    if (!url) {
      setMsg("Incolla prima il link del video.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const response = await fetch(`/api/video?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Sorgente video non riconosciuta.");
      const thumbnail = body.thumbnail || thumbnailForVideoUrl(url);
      if (!thumbnail) {
        throw new Error("Questa fonte non espone una miniatura: caricala a mano.");
      }
      patch({ src: thumbnail, type: "video" });
      setMsg("Miniatura generata dal link del video.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Impossibile generare la miniatura.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber/25 bg-amber/[0.04] p-4 space-y-3">
      <TextInput
        label="Link video"
        value={item.videoUrl || ""}
        onChange={(v) => patch({ videoUrl: v, type: "video" })}
        placeholder="https://www.youtube.com/watch?v=…"
        hint="YouTube, Vimeo o link diretto a un file MP4/WebM."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Btn small onClick={() => void generateThumbnail()} disabled={busy || disabled}>
          {busy ? "Cerco la miniatura…" : "Genera miniatura"}
        </Btn>
        {msg && <span className={`text-xs ${msg.includes("generata") ? "text-emerald-300" : "text-amber"}`}>{msg}</span>}
      </div>
    </div>
  );
}

export function GalleryPanel() {
  const { data, update } = useSite();
  const session = useAdminSession();
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const online = !!session;

  const bulk = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const items: GalleryItem[] = [];
    for (const f of Array.from(files)) {
      try {
        items.push({
          id: uid("g"),
          src: await putFile(await compressImage(f), f.name),
          caption: f.name.replace(/\.[^.]+$/, ""),
          category: "Live",
          shape: "normal",
          published: true,
          type: "image",
          date: new Date().toISOString().slice(0, 10),
        });
      } catch {
        /* file non leggibile: prossimo */
      }
    }
    update((d) => ({ ...d, gallery: [...d.gallery, ...items] }));
    setUploading(false);
  };

  /** Importa dal database foto e video già pubblicati. */
  const sync = async () => {
    setBusy("sync");
    setMsg(null);
    const res = await pullGalleryFromServer(data.gallery);
    setBusy(null);
    if (!res.ok || !res.gallery) {
      setMsg({ ok: false, text: res.error ?? "Sincronizzazione fallita." });
      return;
    }
    update((d) => ({ ...d, gallery: res.gallery! }));
    setMsg({ ok: true, text: "Galleria sincronizzata con il database." });
  };

  // Collegandosi al server, porta dentro anche i video già presenti.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      const res = await pullGalleryFromServer(data.gallery);
      if (!alive || !res.ok || !res.gallery) return;
      update((d) => ({ ...d, gallery: res.gallery! }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  /** Salva foto o video nel database. */
  const save = async (item: GalleryItem) => {
    setBusy(item.id);
    setMsg(null);
    const res = await saveGalleryItem(item);
    if (!res.ok) {
      setBusy(null);
      setMsg({ ok: false, text: res.error ?? "Salvataggio fallito." });
      return;
    }

    const id = res.id || item.dbId;
    const patched = data.gallery.map((x) => (x.id === item.id ? { ...x, dbId: id } : x));
    update((d) => ({ ...d, gallery: d.gallery.map((x) => (x.id === item.id ? { ...x, dbId: id } : x)) }));

    // La risposta del server può contenere la miniatura generata: la si
    // ricarica per mostrarla subito anche nel pannello.
    const pulled = await pullGalleryFromServer(patched);
    if (pulled.ok && pulled.gallery) {
      update((d) => ({ ...d, gallery: pulled.gallery! }));
    }
    setBusy(null);
    setMsg({ ok: true, text: `«${item.caption || "Elemento senza titolo"}» salvato nel database.` });
  };

  /** Elimina l'elemento localmente e, se presente, anche dal database. */
  const remove = async (item: GalleryItem) => {
    if (!confirm(`Eliminare «${item.caption || "questo elemento"}»${item.dbId ? " dal database" : ""}?`)) return;
    setBusy(item.id);
    setMsg(null);
    if (item.dbId) {
      const res = await deleteGalleryItem(item.dbId);
      if (!res.ok) {
        setBusy(null);
        setMsg({ ok: false, text: res.error ?? "Eliminazione fallita." });
        return;
      }
    }
    update((d) => ({ ...d, gallery: d.gallery.filter((x) => x.id !== item.id) }));
    setBusy(null);
    setMsg({ ok: true, text: "Elemento eliminato." });
  };

  return (
    <>
      <PanelHead
        title="Gallery"
        desc="Carica foto e video. Per un video inserisci il link YouTube/Vimeo: la miniatura viene generata automaticamente, oppure caricala a mano."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {online && (
              <Btn small tone="ghost" onClick={() => void sync()} disabled={busy === "sync"}>
                {busy === "sync" ? "Sincronizzo…" : "Sincronizza col database"}
              </Btn>
            )}
            <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => bulk(e.target.files)} />
            <Btn tone="primary" onClick={() => file.current?.click()} disabled={uploading}>
              {uploading ? "Caricamento…" : "Carica foto (multiplo)"}
            </Btn>
          </div>
        }
      />

      {msg && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
          {msg.text}
        </div>
      )}

      <ListEditor
        items={data.gallery}
        onChange={(v) => update((d) => ({ ...d, gallery: v }))}
        addLabel="Aggiungi foto o video"
        thumb={(g) => g.src || thumbnailForVideoUrl(g.videoUrl || "")}
        onDelete={(g) => void remove(g)}
        makeDuplicate={(g) => ({ ...g, id: uid("g"), dbId: undefined })}
        make={(): GalleryItem => ({
          id: uid("g"),
          src: "",
          caption: "",
          category: "Live",
          shape: "normal",
          published: true,
          type: "image",
          videoUrl: "",
          date: new Date().toISOString().slice(0, 10),
        })}
        title={(g) => g.caption || "Senza didascalia"}
        sub={(g) => `${g.type === "video" ? "Video" : "Foto"} · ${g.category} · ${g.shape}${g.published ? "" : " · nascosta"}${g.dbId ? " · su DB" : ""}`}
        render={(g, p) => (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Select
                label="Tipo"
                value={g.type || "image"}
                onChange={(v) => p({ type: v as "image" | "video" })}
                options={[["image", "Foto"], ["video", "Video"]]}
              />
              <TextInput label="Categoria" value={g.category} onChange={(v) => p({ category: v })} hint="LIVE, STUDIO o BACKSTAGE" />
              <TextInput label="Data" type="date" value={g.date || ""} onChange={(v) => p({ date: v })} />
            </div>
            <TextInput label="Didascalia / titolo" value={g.caption} onChange={(v) => p({ caption: v })} />
            {g.type === "video" && <GalleryVideoFields item={g} patch={p} disabled={busy === g.id} />}
            <MediaField
              label={g.type === "video" ? "Miniatura del video" : "Immagine"}
              value={g.src}
              onChange={(v) => p({ src: v })}
              hint="Per YouTube è sufficiente generarla dal link; per le altre fonti puoi caricarla."
            />
            {g.type === "video" && g.src && (
              <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <GalleryThumbnail src={g.src} videoUrl={g.videoUrl} alt={g.caption} className="aspect-video w-full object-cover" />
              </div>
            )}
            <Select label="Forma" value={g.shape} onChange={(v) => p({ shape: v as typeof g.shape })} options={[["normal", "Normale"], ["tall", "Alta"], ["wide", "Larga"]]} />
            <Toggle label="Visibile" value={g.published} onChange={(v) => p({ published: v })} />
            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
              <Btn tone="primary" onClick={() => void save(g)} disabled={busy === g.id || !online}>
                {busy === g.id ? "Salvo…" : g.dbId ? "Aggiorna nel database" : "Crea nel database"}
              </Btn>
              {!online && <span className="text-xs text-bone-dim self-center">Accedi al server da Impostazioni per salvare.</span>}
            </div>
          </>
        )}
      />
    </>
  );
}

/* ─────────────── Eventi ─────────────── */
export function EventsPanel() {
  const { data, update } = useSite();
  return (
    <>
      <PanelHead title="Eventi" desc="Le date compaiono in home e nella pagina contatti; quelle passate vengono nascoste automaticamente." />
      <ListEditor items={data.events} onChange={(v) => update((d) => ({ ...d, events: v }))} addLabel="Nuova data"
        make={() => ({ id: uid("e"), date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), time: "21:30", title: "Nuovo concerto", venue: "", city: "", ticketUrl: "", note: "", published: true })}
        title={(e) => e.title} sub={(e) => `${fmtDate(e.date)} · ${e.venue} ${e.city}${e.published ? "" : " · bozza"}`}
        render={(e, p) => (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <TextInput className="md:col-span-3" label="Titolo" value={e.title} onChange={(v) => p({ title: v })} />
              <TextInput label="Data" type="date" value={e.date} onChange={(v) => p({ date: v })} />
              <TextInput label="Ora" value={e.time} onChange={(v) => p({ time: v })} />
              <TextInput label="Città" value={e.city} onChange={(v) => p({ city: v })} />
              <TextInput className="md:col-span-2" label="Locale" value={e.venue} onChange={(v) => p({ venue: v })} />
              <TextInput label="Link biglietti" value={e.ticketUrl} onChange={(v) => p({ ticketUrl: v })} placeholder="https://" />
              <TextInput className="md:col-span-3" label="Nota" value={e.note} onChange={(v) => p({ note: v })} />
            </div>
            <Toggle label="Pubblicato" value={e.published} onChange={(v) => p({ published: v })} />
          </>
        )}
      />
    </>
  );
}

/* ─────────────── Social & API ─────────────── */
export function SocialPanel() {
  const { data, update } = useSite();
  const api = data.api;
  const setApi = (p: Partial<SiteData["api"]>) => update((d) => ({ ...d, api: { ...d.api, ...p } }));
  return (
    <>
      <PanelHead title="Social & API" desc="Profili mostrati nella pagina Social e collegamento alle API per il feed live." />
      <div className="grid gap-6">
        <Card title="Profili">
          <ListEditor items={data.socials} onChange={(v) => update((d) => ({ ...d, socials: v }))} addLabel="Aggiungi profilo" make={() => ({ id: uid("s"), platform: "Instagram", handle: "", url: "https://", followers: "", enabled: true })} title={(s) => s.platform} sub={(s) => `${s.handle}${s.enabled ? "" : " · nascosto"}`}
            render={(s, p) => (
              <div className="grid md:grid-cols-2 gap-4">
                <TextInput label="Piattaforma" value={s.platform} onChange={(v) => p({ platform: v })} />
                <TextInput label="Handle / nome" value={s.handle} onChange={(v) => p({ handle: v })} />
                <TextInput label="URL profilo" value={s.url} onChange={(v) => p({ url: v })} />
                <TextInput label="Follower (manuale)" value={s.followers} onChange={(v) => p({ followers: v })} hint="YouTube si aggiorna da solo se colleghi l'API." />
                <Toggle label="Visibile" value={s.enabled} onChange={(v) => p({ enabled: v })} />
              </div>
            )}
          />
        </Card>

        <Card title="YouTube Data API v3" desc="Crea una chiave su Google Cloud Console (limita la chiave al tuo dominio, HTTP referrer). Mostra gli ultimi video e gli iscritti.">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="API key" value={api.youtubeKey} onChange={(v) => setApi({ youtubeKey: v })} placeholder="AIza…" />
            <TextInput label="Channel ID" value={api.youtubeChannelId} onChange={(v) => setApi({ youtubeChannelId: v })} placeholder="UC…" />
          </div>
        </Card>
        <Card title="Instagram Graph API" desc="Incolla un access token (Instagram API with Instagram Login, long-lived). Scade dopo 60 giorni: rinnovalo periodicamente.">
          <TextInput label="Access token" value={api.instagramToken} onChange={(v) => setApi({ instagramToken: v })} placeholder="IGQ…" />
        </Card>
        <Card title="Feed JSON personalizzato" desc='URL di un endpoint (con CORS abilitato) che restituisce un array di oggetti {"platform","image","text","url","date"}. Utile per aggregatori o automazioni.'>
          <TextInput label="URL feed" value={api.feedUrl} onChange={(v) => setApi({ feedUrl: v })} placeholder="https://…/feed.json" />
        </Card>
        <Card title="Player incorporati" desc="Compaiono nella pagina Musica.">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="Spotify (URL artista/album/playlist)" value={api.spotifyEmbed} onChange={(v) => setApi({ spotifyEmbed: v })} placeholder="https://open.spotify.com/artist/…" />
            <TextInput label="SoundCloud (URL profilo/playlist)" value={api.soundcloudEmbed} onChange={(v) => setApi({ soundcloudEmbed: v })} placeholder="https://soundcloud.com/…" />
          </div>
        </Card>
        <Card title="Post manuali (fallback)" desc="Mostrati quando nessuna API è collegata o nessuna risponde.">
          <ListEditor items={data.posts} onChange={(v) => update((d) => ({ ...d, posts: v }))} addLabel="Aggiungi post" thumb={(p) => p.image} make={() => ({ id: uid("po"), platform: "Instagram", image: "", text: "", url: "", date: new Date().toISOString().slice(0, 10) })} title={(p) => p.text || "Post"} sub={(p) => `${p.platform} · ${p.date.slice(0, 10)}`}
            render={(p, patch) => (
              <>
                <MediaField label="Immagine" value={p.image} onChange={(v) => patch({ image: v })} />
                <TextArea label="Testo" rows={2} value={p.text} onChange={(v) => patch({ text: v })} />
                <div className="grid md:grid-cols-3 gap-4">
                  <TextInput label="Piattaforma" value={p.platform} onChange={(v) => patch({ platform: v })} />
                  <TextInput label="Link" value={p.url} onChange={(v) => patch({ url: v })} />
                  <TextInput label="Data" type="date" value={p.date.slice(0, 10)} onChange={(v) => patch({ date: v })} />
                </div>
              </>
            )}
          />
        </Card>
      </div>
    </>
  );
}

/* ─────────────── Messaggi ─────────────── */
export function MessagesPanel() {
  const { data, update } = useSite();
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => {
    setOpen(open === id ? null : id);
    update((d) => ({ ...d, messages: d.messages.map((m) => (m.id === id ? { ...m, read: true } : m)) }));
  };
  return (
    <>
      <PanelHead title="Messaggi" desc="Tutte le richieste arrivate dal form contatti." />
      {data.messages.length === 0 ? (
        <Card>
          <p className="text-sm text-bone-dim">Nessun messaggio ancora.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.messages.map((m) => (
            <div key={m.id} className={`rounded-xl border ${m.read ? "border-white/10" : "border-amber/50 bg-amber/5"}`}>
              <button onClick={() => toggle(m.id)} className="w-full flex flex-wrap items-center gap-4 p-4 text-left">
                {!m.read && <span className="w-2 h-2 rounded-full bg-amber" />}
                <span className="flex-1 min-w-[10rem]">
                  <span className="block text-sm font-medium">{m.name}</span>
                  <span className="block text-xs text-bone-dim">{m.topic}</span>
                </span>
                <span className="text-xs text-bone-dim">{fmtDate(m.date)}</span>
              </button>
              {open === m.id && (
                <div className="border-t border-white/10 p-4 space-y-4 text-sm">
                  <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                  <div className="text-bone-dim text-xs">
                    {m.email}
                    {m.eventDate && ` · data richiesta: ${fmtDate(m.eventDate)}`}
                  </div>
                  <div className="flex gap-2">
                    <a className="rounded-lg bg-amber text-ink px-4 py-2 text-sm font-semibold" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.topic)}`}>
                      Rispondi
                    </a>
                    <Btn tone="danger" onClick={() => confirm("Eliminare il messaggio?") && update((d) => ({ ...d, messages: d.messages.filter((x) => x.id !== m.id) }))}>
                      Elimina
                    </Btn>
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

/* ─────────────── Impostazioni ─────────────── */
export function SettingsPanel() {
  const { data, update, replaceAll, reset } = useSite();
  const s = data.settings;
  const set = (p: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  const imp = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const doExport = async () => {
    setMsg("Preparo il backup…");
    const text = await exportBackup(data);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setMsg("Backup scaricato (include anche i file caricati).");
  };
  const doPublish = async () => {
    setMsg("Preparo la pubblicazione…");
    const text = await exportPublish(data as unknown as Parameters<typeof exportPublish>[0]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = "site-data.json";
    a.click();
    setMsg(`site-data.json pronto (${(text.length / 1048576).toFixed(1)} MB): caricalo accanto a index.html sul tuo hosting.`);
  };
  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      replaceAll((await importBackup(await f.text())) as SiteData);
      setMsg("Backup importato correttamente.");
    } catch {
      setMsg("File non valido.");
    }
  };

  return (
    <>
      <PanelHead title="Impostazioni" desc="Identità, SEO, shop, pagamenti, sicurezza e backup." />
      <div className="grid gap-6">
        <Card title="Identità e contatti">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="Nome artista" value={s.artistName} onChange={(v) => set({ artistName: v })} />
            <TextInput label="Tagline" value={s.tagline} onChange={(v) => set({ tagline: v })} />
            <TextInput label="Email info" value={s.email} onChange={(v) => set({ email: v })} />
            <TextInput label="Email booking" value={s.bookingEmail} onChange={(v) => set({ bookingEmail: v })} />
            <TextInput label="Telefono" value={s.phone} onChange={(v) => set({ phone: v })} />
            <TextInput label="Base / località" value={s.location} onChange={(v) => set({ location: v })} />
            <Select label="Colore accento" value={s.accent} onChange={(v) => set({ accent: v as typeof s.accent })} options={[["amber", "Ambra"], ["copper", "Rame acceso"], ["oxide", "Oro ossidato"]]} />
          </div>
        </Card>
        <Card title="SEO">
          <div className="grid gap-4">
            <TextInput label="Titolo pagina" value={s.seoTitle} onChange={(v) => set({ seoTitle: v })} />
            <TextArea label="Meta description" rows={2} value={s.seoDescription} onChange={(v) => set({ seoDescription: v })} />
          </div>
        </Card>
        <Card title="Shop e pagamenti" desc="Il sito è statico: gli ordini vengono registrati nel pannello e il pagamento avviene tramite i link qui sotto. Per un checkout con webhook collega Stripe Payment Links.">
          <div className="grid md:grid-cols-2 gap-4">
            <TextInput label="Valuta (simbolo)" value={s.currency} onChange={(v) => set({ currency: v })} />
            <NumberInput label="Spedizione fissa" step={0.5} value={s.shippingFee} onChange={(v) => set({ shippingFee: v })} />
            <NumberInput label="Spedizione gratis oltre" value={s.freeShippingOver} onChange={(v) => set({ freeShippingOver: v })} />
            <TextInput label="PayPal.me (username)" value={s.paypalMe} onChange={(v) => set({ paypalMe: v })} placeholder="peppetaglieri" />
            <TextInput label="Stripe Payment Link generico" value={s.stripeLink} onChange={(v) => set({ stripeLink: v })} placeholder="https://buy.stripe.com/…" />
            <TextArea label="Istruzioni di pagamento (mostrate dopo l'ordine)" rows={2} value={s.paymentNote} onChange={(v) => set({ paymentNote: v })} />
          </div>
        </Card>
        <Card title="Form contatti" desc="Facoltativo: endpoint POST JSON (Formspree, Getform, Basin…) per ricevere i messaggi anche via email. In ogni caso i messaggi sono salvati nel pannello.">
          <TextInput label="Endpoint" value={s.formEndpoint} onChange={(v) => set({ formEndpoint: v })} placeholder="https://formspree.io/f/xxxxxx" />
        </Card>
        <Card title="Pubblica le modifiche" desc="Il pannello salva nel tuo browser. Per mostrare i cambiamenti a tutti i visitatori scarica site-data.json e caricalo nella stessa cartella di index.html (Netlify, Vercel, cPanel, S3…). Il sito lo legge all'avvio. Ordini, messaggi e password non vengono inclusi.">
          <div className="flex flex-wrap gap-3 items-center">
            <Btn tone="primary" onClick={doPublish}>Scarica site-data.json</Btn>
            <span className="text-xs text-bone-dim max-w-md">Consiglio: per file audio/immagini pesanti usa URL su CDN invece dei caricamenti locali, così il file resta leggero.</span>
          </div>
        </Card>
        <Card title="Connessione al database" desc="Collega il pannello al database del sito: gli album, i brani e i formati salvati diventano visibili a tutti i visitatori, da ogni dispositivo.">
          <ServerConnection />
        </Card>
        <Card title="Sicurezza">
          <TextInput label="Password pannello admin" value={s.adminPassword} onChange={(v) => set({ adminPassword: v })} />
          <p className="text-xs text-bone-dim mt-3">Nota: la password locale protegge l'accesso all'interfaccia. Per scrivere nel database serve anche la connessione al server qui sopra.</p>
        </Card>
        <Card title="Backup e ripristino" desc="Esporta tutto (contenuti, ordini, messaggi e file caricati) in un unico JSON; importalo su un altro browser o dominio.">
          <div className="flex flex-wrap gap-3 items-center">
            <Btn tone="primary" onClick={doExport}>Esporta backup</Btn>
            <input ref={imp} type="file" accept="application/json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
            <Btn onClick={() => imp.current?.click()}>Importa backup</Btn>
            <Btn tone="danger" onClick={async () => { if (confirm("Ripristinare i contenuti iniziali? Ordini, messaggi e file caricati andranno persi.")) { await clearFiles(); reset(); setMsg("Ripristinato."); } }}>Ripristina predefiniti</Btn>
            {msg && <span className="text-sm text-amber">{msg}</span>}
          </div>
        </Card>
      </div>
    </>
  );
}
