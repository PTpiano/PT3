/**
 * Sincronizzazione dell'admin della SPA con il database del sito.
 *
 * La SPA ha due modi di funzionare:
 *  · locale  — tutto in localStorage (funziona senza server, ma i dati
 *               vivono solo in questo browser);
 *  · server  — connesso a /api/admin, gli album vengono scritti nel
 *               PostgreSQL e letti da tutti i visitatori.
 *
 * Questo modulo parla con le API Next usando lo stesso token JWT del
 * pannello admin del sito (endpoint /api/admin/login).
 */

import { useEffect, useState } from "react";
import { getFile, getFileName } from "./media";
import { KIND_TO_DB, mapAlbums, mapImages, type ApiAlbum, type ApiImage } from "./backend";
import type { Format, GalleryItem, Product, Track } from "./data";

const TOKEN_KEY = "nocturne.admin.token";
const USER_KEY = "nocturne.admin.user";
/** Evento emesso quando la sessione cambia: i pannelli si aggiornano. */
const SESSION_EVENT = "nocturne.admin.session";

export interface AdminSession {
  token: string;
  email: string;
}

/* ── sessione ────────────────────────────────────────────────────────────── */

export function getSession(): AdminSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const email = localStorage.getItem(USER_KEY);
    return token && email ? { token, email } : null;
  } catch {
    return null;
  }
}

export function setSession(s: AdminSession | null) {
  try {
    if (s) {
      localStorage.setItem(TOKEN_KEY, s.token);
      localStorage.setItem(USER_KEY, s.email);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* storage non disponibile */
  }
  // Avvisa i pannelli: lo stato "collegato" cambia senza ricaricare.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EVENT));
}

/** Sessione admin come hook: si aggiorna da sola a ogni login/logout. */
export function useAdminSession(): AdminSession | null {
  const [session, setSessionState] = useState<AdminSession | null>(getSession);
  useEffect(() => {
    const h = () => setSessionState(getSession());
    window.addEventListener(SESSION_EVENT, h);
    return () => window.removeEventListener(SESSION_EVENT, h);
  }, []);
  return session;
}

/** Login admin: POST /api/admin/login → token JWT. */
export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: body.error || `Login fallito (${r.status})` };
    setSession({ token: body.access_token, email: body.user?.email ?? email });
    return { ok: true };
  } catch {
    return { ok: false, error: "Server non raggiungibile." };
  }
}

export function logout() {
  setSession(null);
}

function authHeaders(): Record<string, string> {
  const s = getSession();
  return s ? { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` } : { "Content-Type": "application/json" };
}

/* ── upload ──────────────────────────────────────────────────────────────── */

/**
 * Carica un file su /api/upload e restituisce l'URL pubblico.
 * `fileType`: "audio" (master), "image" (galleria), "album" (copertina).
 */
export async function uploadFile(file: Blob, fileName: string, fileType: "audio" | "image" | "album"): Promise<string> {
  const s = getSession();
  if (!s) throw new Error("Sessione admin assente.");
  const fd = new FormData();
  fd.append("fileType", fileType);
  fd.append("file", new File([file], fileName, { type: file.type || "application/octet-stream" }));
  const r = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${s.token}` }, body: fd });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Upload fallito (${r.status})`);
  return body.fileUrl as string;
}

/**
 * Risolve un riferimento media ("idb:xxx", "asset:hero", URL) in un URL
 * pubblico caricabile. Gli idb: sono i file nel browser: prima vanno
 * letti da IndexedDB e poi caricati sul server.
 */
export async function resolveMediaUrl(ref: string, fileType: "audio" | "image" | "album"): Promise<string> {
  if (!ref) return "";
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("/uploads/")) return ref;
  if (ref.startsWith("idb:")) {
    const blob = await getFile(ref);
    if (!blob) throw new Error(`File non trovato nel browser: ${ref}`);
    // Si usa il nome originale del file (es. "brano.mp3"), non un nome
    // generico: il visitatore vede il file vero quando lo scarica.
    const original = await getFileName(ref);
    const name = original || `file-${Date.now()}.${fileType === "audio" ? "mp3" : "jpg"}`;
    return uploadFile(blob, name, fileType);
  }
  // "asset:xxx" → immagine inclusa nel bundle: non caricabile, si lascia.
  return "";
}

/* ── album ───────────────────────────────────────────────────────────────── */

/** Un id del database è un uuid: lo usiamo per distinguere i brani già salvati. */
const isDbId = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Un riferimento utilizzabile sul sito pubblico (URL o file già caricato). */
const isPublicRef = (ref: string): boolean =>
  !!ref && (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("/uploads/"));

/** Payload del prodotto della SPA → corpo della API album. */
function toApiBody(p: Product, tracks: Track[]) {
  const albumTracks = p.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => ({
      // Solo gli id reali del database (uuid) vengono inviati: con quelli
      // l'API aggiorna la riga esistente invece di ricrearla.
      ...(isDbId(t!.id) ? { id: t!.id } : {}),
      title: t!.title,
      duration: t!.durationSec,
      audioUrl: t!.audio || "",
      lyrics: t!.story || "",
      published: t!.published !== false,
    }));

  // Solo i formati attivi finiscono in shop_config: è la lista che il
  // visitatore vede nello shop.
  const formats = p.formats
    .filter((f) => f.enabled !== false)
    .map((f) => ({
      id: f.id,
      kind: KIND_TO_DB[f.kind],
      label: f.label,
      price: f.price,
      pwyw: f.pwyw,
      min: f.min,
      stock: f.stock,
      // "asset:xxx" non è un indirizzo pubblico: non viene salvato.
      file: f.file && !f.file.startsWith("asset:") ? f.file : undefined,
    }));

  return {
    title: p.title,
    description: p.description,
    year: Number(p.year) || undefined,
    release_date: p.year ? `${p.year}-01-01` : undefined,
    // Le copertine "asset:xxx" sono immagini incluse nel bundle della SPA:
    // non sono indirizzi pubblici, quindi non vengono mandate al database.
    cover_url: isPublicRef(p.cover) ? p.cover : undefined,
    genre: "Jazz Fusion",
    is_featured: p.featured,
    published: p.published,
    shop_config: formats.length ? { formats, paymentLink: p.paymentLink || undefined } : null,
    tracks: albumTracks,
  };
}

/**
 * Crea o aggiorna un album nel database.
 * Restituisce l'id dell'album (nuovo o esistente).
 */
export async function saveProduct(p: Product, tracks: Track[]): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!getSession()) return { ok: false, error: "Sessione admin assente." };
  try {
    const body = toApiBody(p, tracks);

    // I file audio dei brani devono essere URL pubblici: se sono ancora
    // nel browser (idb:) li carichiamo adesso.
    const resolved = await Promise.all(
      body.tracks.map(async (t) => {
        if (!t.audioUrl) return { ...t, audioUrl: "" };
        if (t.audioUrl.startsWith("idb:")) {
          const url = await resolveMediaUrl(t.audioUrl, "audio");
          return { ...t, audioUrl: url };
        }
        return t;
      })
    );
    body.tracks = resolved;

    if (p.cover && p.cover.startsWith("idb:")) {
      body.cover_url = await resolveMediaUrl(p.cover, "album");
    }

    // I formati digitali hanno un file di consegna: idb: → upload.
    if (body.shop_config?.formats) {
      for (const f of body.shop_config.formats) {
        if (f.file && f.file.startsWith("idb:")) {
          const url = await resolveMediaUrl(f.file, "audio");
          f.file = url || undefined;
        }
      }
    }

    if (p.dbId) {
      const r = await fetch(`/api/albums/${p.dbId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return { ok: false, error: err.error || `Aggiornamento fallito (${r.status})` };
      }
      return { ok: true, id: p.dbId };
    }

    const r = await fetch("/api/albums", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: err.error || `Creazione fallita (${r.status})` };
    }
    const created = await r.json();
    return { ok: true, id: created?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Salvataggio fallito" };
  }
}

/** Elimina un album dal database. */
export async function deleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!getSession()) return { ok: false, error: "Sessione admin assente." };
  try {
    const r = await fetch(`/api/albums/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: err.error || `Eliminazione fallita (${r.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eliminazione fallita" };
  }
}

/* ── galleria ────────────────────────────────────────────────────────────── */

const DB_CATEGORIES = new Set(["LIVE", "STUDIO", "BACKSTAGE"]);

/** Le categorie del database sono fissate; le altre diventano LIVE. */
function galleryCategory(category: string): "LIVE" | "STUDIO" | "BACKSTAGE" {
  const value = category.trim().toUpperCase();
  if (DB_CATEGORIES.has(value)) return value as "LIVE" | "STUDIO" | "BACKSTAGE";
  if (value.includes("STUDIO")) return "STUDIO";
  if (value.includes("BACKSTAGE")) return "BACKSTAGE";
  return "LIVE";
}

/**
 * Crea o aggiorna un elemento della galleria.
 *
 * Le miniature rimaste nel browser (`idb:`) vengono caricate sul server
 * prima della scrittura. Per YouTube la miniatura può anche essere
 * generata dal server quando non ne è stata caricata una.
 */
export async function saveGalleryItem(item: GalleryItem): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!getSession()) return { ok: false, error: "Sessione admin assente." };

  const title = item.caption.trim();
  if (!title) return { ok: false, error: "Inserisci un titolo per l'elemento." };

  const videoUrl = (item.videoUrl || "").trim();
  const isVideo = item.type === "video" || !!videoUrl;
  if (isVideo && !videoUrl) {
    return { ok: false, error: "Inserisci il link del video (YouTube, Vimeo o file diretto)." };
  }

  try {
    let src = (item.src || "").trim();
    if (src.startsWith("idb:")) {
      src = await resolveMediaUrl(src, "image");
    }
    if (!isPublicRef(src) && src !== "") {
      return { ok: false, error: "Carica la miniatura su Internet: le immagini incluse nel pannello non sono pubbliche." };
    }
    if (!src && !isVideo) {
      return { ok: false, error: "Carica una miniatura per la foto." };
    }

    const body = {
      // Se manca, il server la ricava dal video (YouTube/Vimeo). Se già
      // esiste, non la sovrascriviamo con una miniatura vuota.
      ...(src ? { src } : {}),
      title,
      description: "",
      category: galleryCategory(item.category),
      date: item.date || new Date().toISOString().slice(0, 10),
      type: isVideo ? "video" : "image",
      video_url: isVideo ? videoUrl : null,
    };

    const url = item.dbId ? `/api/gallery/images/${item.dbId}` : "/api/gallery/images";
    const r = await fetch(url, {
      method: item.dbId ? "PATCH" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: err.error || `Salvataggio fallito (${r.status})` };
    }

    const result = await r.json().catch(() => ({}));
    return { ok: true, id: item.dbId || result?.id || result?.image?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Salvataggio fallito" };
  }
}

/** Elimina un elemento della galleria dal database. */
export async function deleteGalleryItem(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!getSession()) return { ok: false, error: "Sessione admin assente." };
  try {
    const r = await fetch(`/api/gallery/images/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { ok: false, error: err.error || `Eliminazione fallita (${r.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eliminazione fallita" };
  }
}

/**
 * Porta nel pannello gli elementi già presenti nel database.
 *
 * Gli elementi locali restano prioritari: vengono completati soltanto
 * con i campi mancanti. Quelli che esistono solo sul server vengono
 * aggiunti alla lista.
 */
export async function pullGalleryFromServer(
  local: GalleryItem[]
): Promise<{ ok: boolean; gallery?: GalleryItem[]; error?: string }> {
  try {
    const r = await fetch("/api/gallery/images?all=1", { cache: "no-store" });
    if (!r.ok) return { ok: false, error: `Lettura dal server fallita (${r.status})` };
    const rows = (await r.json()) as ApiImage[];
    const remote = mapImages(Array.isArray(rows) ? rows : []);
    const merged = [...local];

    for (const item of remote) {
      const index = merged.findIndex(
        (x) => (item.dbId && x.dbId === item.dbId) || (item.dbId && x.id === item.dbId)
      );
      if (index >= 0) {
        const current = merged[index];
        merged[index] = {
          ...current,
          src: current.src || item.src,
          caption: current.caption || item.caption,
          category: current.category || item.category,
          type: (current.videoUrl || current.type === "video") ? "video" : current.type || item.type,
          videoUrl: current.videoUrl || item.videoUrl,
          date: current.date || item.date,
          dbId: item.dbId || current.dbId,
        };
      } else {
        merged.push(item);
      }
    }

    return { ok: true, gallery: merged };
  } catch {
    return { ok: false, error: "Server non raggiungibile." };
  }
}

/** Scarica dal server gli album (per la vista admin). */
export async function fetchAlbums(): Promise<{ ok: boolean; albums?: any[]; error?: string }> {
  try {
    const r = await fetch("/api/albums?all=1", { cache: "no-store", headers: authHeaders() });
    if (!r.ok) return { ok: false, error: ` caricamento fallito (${r.status})` };
    return { ok: true, albums: await r.json() };
  } catch {
    return { ok: false, error: "Server non raggiungibile." };
  }
}

/* ── import dal server ────────────────────────────────────────────────────── */

/** Normalizza un titolo per il confronto (minuscole, spazi compattati). */
const normTitle = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Porta nel pannello admin gli album che stanno già nel database.
 *
 * Serve a due cose:
 *  · mostrare all'admin gli album pubblicati dal pannello Next;
 *  · associare a ogni prodotto locale il suo id del database, così il
 *    pulsante "Salva" aggiorna l'album esistente invece di crearne uno
 *    identico.
 *
 * I prodotti locali senza corrispondenza restano: sono bozze dell'admin.
 */
export async function pullFromServer(
  products: Product[],
  tracks: Track[]
): Promise<{ ok: boolean; products?: Product[]; tracks?: Track[]; error?: string }> {
  try {
    const r = await fetch("/api/albums?all=1", { cache: "no-store", headers: authHeaders() });
    if (!r.ok) return { ok: false, error: `Lettura dal server fallita (${r.status})` };
    const rows = (await r.json()) as ApiAlbum[];
    const remote = mapAlbums(Array.isArray(rows) ? rows : []);

    // --- brani: riusa quelli locali con lo stesso id o titolo -----------
    const localTracks = [...tracks];
    const trackById = new Map(localTracks.map((t) => [t.id, t]));
    const trackByTitle = new Map(localTracks.map((t) => [normTitle(t.title), t]));
    /** id remoto → id locale (così i producti restano coerenti) */
    const idMap = new Map<string, string>();

    for (const rt of remote.tracks) {
      const existing = trackById.get(rt.id) ?? trackByTitle.get(normTitle(rt.title));
      if (existing) {
        const merged: Track = {
          ...existing,
          title: rt.title,
          subtitle: rt.subtitle || existing.subtitle,
          durationSec: rt.durationSec || existing.durationSec,
          cover: rt.cover || existing.cover,
          audio: rt.audio || existing.audio,
          story: rt.story || existing.story,
          year: rt.year || existing.year,
          published: rt.published,
        };
        const i = localTracks.findIndex((t) => t.id === existing.id);
        if (i >= 0) localTracks[i] = merged;
        idMap.set(rt.id, merged.id);
      } else {
        localTracks.push(rt);
        idMap.set(rt.id, rt.id);
      }
    }

    // --- prodotti: abbina per id del database o per titolo -------------
    const localProducts = [...products];
    for (const rp of remote.products) {
      const i = localProducts.findIndex(
        (p) =>
          (rp.dbId && p.dbId === rp.dbId) ||
          (p.dbId === undefined && normTitle(p.title) === normTitle(rp.title))
      );
      const trackIds = rp.trackIds.map((id) => idMap.get(id) ?? id);
      if (i >= 0) {
        localProducts[i] = {
          ...localProducts[i],
          dbId: rp.dbId ?? localProducts[i].dbId,
          title: rp.title,
          year: rp.year || localProducts[i].year,
          cover: rp.cover || localProducts[i].cover,
          description: rp.description,
          trackIds,
          formats: rp.formats,
          downloadUrl: rp.downloadUrl || localProducts[i].downloadUrl,
          paymentLink: rp.paymentLink || localProducts[i].paymentLink,
          featured: rp.featured,
          published: rp.published,
        };
      } else {
        localProducts.push({ ...rp, trackIds });
      }
    }

    return { ok: true, products: localProducts, tracks: localTracks };
  } catch {
    return { ok: false, error: "Server non raggiungibile." };
  }
}

/** Riepilogo dei formati attivi, per l'anteprima in admin. */
export function formatSummary(f: Format): string {
  if (f.enabled === false) return "disattivato";
  if (f.pwyw) return `offerta libera (min ${f.min} €)`;
  return `${f.price} €`;
}
