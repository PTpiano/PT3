/**
 * Collegamento al backend del sito (Next.js API → PostgreSQL).
 *
 * La SPA nasceva con contenuti demo in `data.ts` e uno snapshot statico
 * `./site-data.json`. Questo modulo aggiunge la terza sorgente — e la
 * principale: i dati reali del database.
 *
 * Ordine di caricamento (vedi store.tsx):
 *   1. draft locale dell'admin (localStorage)  — vince su tutto
 *   2. backend (questo modulo)                 — database reale
 *   3. ./site-data.json                        — snapshot statico di fallback
 *
 * Ogni chiamata è isolata: se un'endpoint non risponde, le altre
 * continuano e la sezione resta ai valori demo.
 */

import type {
  EventItem,
  Format,
  FormatKind,
  GalleryItem,
  Product,
  SiteData,
  SocialPost,
  SocialProfile,
  Track,
} from "./data";

/** Base URL API: stesso origin (in dev passa dal proxy di vite.config.ts). */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

async function j<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    const body = await r.json();
    return (body && !body.error ? body : null) as T | null;
  } catch {
    return null;
  }
}

/* ── Tipi grezzi delle API (solo i campi che usiamo) ─────────────────────── */

interface ApiTrack {
  id?: string;
  title: string;
  duration?: number | null;
  track_number?: number | null;
  audio_url?: string | null;
  lyrics?: string | null;
  published?: boolean | null;
}

export interface ApiAlbum {
  id: string;
  title: string;
  description?: string | null;
  release_date?: string | null;
  year?: number | null;
  cover_url?: string | null;
  is_featured?: boolean;
  published?: boolean;
  price_cd?: number | null;
  price_vinyl?: number | null;
  price_digital?: number | null;
  price_hires?: number | null;
  price_tape?: number | null;
  stock_cd?: number | null;
  stock_vinyl?: number | null;
  stock_tape?: number | null;
  is_on_offer?: boolean;
  discount_percent?: number | null;
  shop_config?: unknown;
  tracks?: ApiTrack[];
}

/** Formato del database (stesso vocabolario del sito Next). */
interface ApiShopFormat {
  id?: string;
  kind: "digital" | "hires" | "vinyl" | "cd" | "tape";
  label?: string;
  price?: number;
  pwyw?: boolean;
  min?: number;
  stock?: number | null;
  file?: string;
  note?: string;
}

export interface ApiImage {
  id: string;
  src: string;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  date?: string | null;
  type?: string | null;
  video_url?: string | null;
}

interface ApiTourDate {
  id: string;
  date: string;
  venue?: string | null;
  city?: string | null;
  time?: string | null;
  ticket_url?: string | null;
  country?: string | null;
}

interface ApiSocialPost {
  id: string;
  platform?: string | null;
  title?: string | null;
  caption?: string | null;
  content?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  external_url?: string | null;
  created_at?: string | null;
}

type ApiSocialConfig = Record<string, string>;

/* ── Mapping ─────────────────────────────────────────────────────────────── */

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** kind del database → kind della SPA. */
const KIND_FROM_DB: Record<ApiShopFormat["kind"], FormatKind> = {
  digital: "digital",
  hires: "flac",
  vinyl: "vinyl",
  cd: "cd",
  tape: "cassette",
};

/** kind della SPA → kind del database. */
export const KIND_TO_DB: Record<FormatKind, ApiShopFormat["kind"]> = {
  digital: "digital",
  flac: "hires",
  vinyl: "vinyl",
  cd: "cd",
  cassette: "tape",
};

const DEFAULT_LABEL: Record<FormatKind, string> = {
  digital: "Download digitale (MP3 320)",
  flac: "Download lossless (FLAC 24 bit)",
  cd: "CD",
  vinyl: "Vinile",
  cassette: "Musicassetta",
};

/** Legge e valida `shop_config` arrivato dal database. */
function parseApiShopConfig(raw: unknown): ApiShopFormat[] | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const list = (obj as { formats?: unknown }).formats;
  if (!Array.isArray(list)) return null;
  const out: ApiShopFormat[] = [];
  for (const f of list) {
    if (!f || typeof f !== "object") continue;
    const fo = f as Record<string, unknown>;
    const kind = fo.kind;
    if (kind !== "digital" && kind !== "hires" && kind !== "vinyl" && kind !== "cd" && kind !== "tape") continue;
    out.push({
      id: typeof fo.id === "string" ? fo.id : undefined,
      kind,
      label: typeof fo.label === "string" ? fo.label : undefined,
      price: num(fo.price) ?? 0,
      pwyw: !!fo.pwyw,
      min: num(fo.min) ?? 0,
      stock: fo.stock === null || fo.stock === undefined ? null : num(fo.stock),
      file: typeof fo.file === "string" ? fo.file : undefined,
      note: typeof fo.note === "string" ? fo.note : undefined,
    });
  }
  return out.length ? out : null;
}

/**
 * I formati di un album.
 *
 * Se il database manda `shop_config` (impostato dal pannello admin), la
 * lista è esattamente quella: ogni formato può essere attivo o disattivato.
 * Altrimenti si ricava dalle colonne price_ e stock_ come prima.
 */
function formatsFor(a: ApiAlbum): Format[] {
  const cfg = parseApiShopConfig(a.shop_config);
  if (cfg) {
    return cfg.map((f) => {
      const kind = KIND_FROM_DB[f.kind];
      return {
        id: f.id || `${a.id}-${f.kind}`,
        kind,
        label: f.label || DEFAULT_LABEL[kind],
        price: num(f.price) ?? 0,
        pwyw: !!f.pwyw,
        min: num(f.min) ?? 0,
        stock: f.stock === null || f.stock === undefined ? null : num(f.stock),
        enabled: true,
        file: f.file || "",
      };
    });
  }

  const out: Format[] = [];
  const discount =
    a.is_on_offer && num(a.discount_percent) !== null && (num(a.discount_percent) as number) > 0
      ? 1 - (num(a.discount_percent) as number) / 100
      : 1;
  const price = (v: unknown) => {
    const n = num(v);
    return n === null ? null : round2(n * discount);
  };

  const digital = price(a.price_digital);
  // Digitale sempre disponibile: prezzo fisso del DB, oppure offerta libera.
  out.push({
    id: `${a.id}-digital`,
    kind: "digital",
    label: DEFAULT_LABEL.digital,
    price: digital ?? 7,
    pwyw: digital === null,
    min: 0,
    stock: null,
    enabled: true,
    file: "",
  });
  const hires = price(a.price_hires);
  if (hires !== null)
    out.push({ id: `${a.id}-flac`, kind: "flac", label: DEFAULT_LABEL.flac, price: hires, pwyw: false, min: hires, stock: null, enabled: true, file: "" });
  const vinyl = price(a.price_vinyl);
  if (vinyl !== null && num(a.stock_vinyl) !== 0)
    out.push({ id: `${a.id}-vinyl`, kind: "vinyl", label: DEFAULT_LABEL.vinyl, price: vinyl, pwyw: false, min: vinyl, stock: num(a.stock_vinyl), enabled: true, file: "" });
  const cd = price(a.price_cd);
  if (cd !== null && num(a.stock_cd) !== 0)
    out.push({ id: `${a.id}-cd`, kind: "cd", label: DEFAULT_LABEL.cd, price: cd, pwyw: false, min: cd, stock: num(a.stock_cd), enabled: true, file: "" });
  const tape = price(a.price_tape);
  if (tape !== null && num(a.stock_tape) !== 0)
    out.push({ id: `${a.id}-tape`, kind: "cassette", label: DEFAULT_LABEL.cassette, price: tape, pwyw: false, min: tape, stock: num(a.stock_tape), enabled: true, file: "" });

  return out;
}

/**
 * Album → prodotti shop + tracce riproducibili.
 * I formati arrivano da `shop_config` quando il pannello admin li ha
 * definiti, altrimenti dalle colonne price_ e stock_ del database.
 */
export function mapAlbums(rows: ApiAlbum[]): { products: Product[]; tracks: Track[] } {
  const products: Product[] = [];
  const tracks: Track[] = [];

  for (const a of rows) {
    const year = String(
      num(a.year) ?? (a.release_date ? String(a.release_date).slice(0, 4) : "")
    );

    const formats = formatsFor(a);

    const trackIds: string[] = [];
    const ordered = [...(a.tracks ?? [])].sort(
      (x, y) => (x.track_number ?? 0) - (y.track_number ?? 0)
    );
    ordered.forEach((t, i) => {
      const id = t.id ?? `${a.id}-${i}`;
      trackIds.push(id);
      tracks.push({
        id,
        title: t.title,
        subtitle: a.title,
        durationSec: num(t.duration) ?? 0,
        cover: a.cover_url || "",
        audio: t.audio_url || "",
        story: t.lyrics || "",
        year,
        mood: "",
        published: t.published === null || t.published === undefined ? true : !!t.published,
      });
    });

    products.push({
      id: a.id,
      title: a.title,
      type: "album",
      year,
      cover: a.cover_url || "",
      description: a.description || "",
      trackIds,
      formats,
      downloadUrl: "",
      paymentLink: "",
      featured: !!a.is_featured,
      published: a.published === undefined ? true : !!a.published,
      dbId: a.id,
    });
  }

  return { products, tracks };
}

const CAT_LABEL: Record<string, string> = {
  LIVE: "Live",
  STUDIO: "Studio",
  BACKSTAGE: "Backstage",
};

/** Trasforma le righe della galleria del database nel modello della SPA. */
export function mapImages(rows: ApiImage[]): GalleryItem[] {
  const shapes: GalleryItem["shape"][] = ["normal", "tall", "wide"];
  return rows.map((r, i) => ({
    id: r.id,
    src: r.src,
    caption: r.title || r.description || "Senza titolo",
    category: CAT_LABEL[r.category ?? ""] ?? r.category ?? "Live",
    shape: shapes[i % shapes.length],
    published: true,
    type: r.type === "video" ? "video" : "image",
    videoUrl: r.type === "video" ? r.video_url || "" : "",
    date: r.date || "",
    dbId: r.id,
  }));
}

/** "2025-11-23" / "Nov 23, 2025" / "23 novembre 2025" → YYYY-MM-DD. */
function toIso(raw?: string | null): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const EN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const IT: Record<string, number> = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
  const m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s*(\d{4})?/);
  if (m) {
    const key = m[1].slice(0, 3).toLowerCase();
    const month = EN[key] ?? IT[key];
    if (month) {
      const year = m[3] ?? String(new Date().getFullYear());
      return `${year}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

function mapDates(rows: ApiTourDate[]): EventItem[] {
  return rows.map((r) => ({
    id: r.id,
    date: toIso(r.date),
    time: r.time || "",
    title: r.venue || "Dal vivo",
    venue: r.venue || "",
    city: r.city || "",
    ticketUrl: r.ticket_url || "",
    note: r.country || "",
    published: true,
  }));
}

function mapPosts(rows: ApiSocialPost[]): SocialPost[] {
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform || "Social",
    image: r.thumbnail_url || r.image_url || "",
    text: r.title || r.caption || r.content || "",
    url: r.external_url || "",
    date: (r.created_at || new Date().toISOString()).slice(0, 10),
  }));
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  facebook: "Facebook",
  tiktok: "TikTok",
  appleMusic: "Apple Music",
};

function mapSocials(cfg: ApiSocialConfig | null): SocialProfile[] | null {
  if (!cfg) return null;
  const entries = Object.entries(cfg).filter(([, v]) => String(v || "").trim());
  if (!entries.length) return null; // non configurato → restano i default
  return entries.map(([key, value]) => {
    const v = String(value).trim();
    const isUrl = /^https?:\/\//i.test(v);
    return {
      id: key,
      platform: SOCIAL_LABELS[key] ?? key,
      handle: isUrl ? v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : v,
      url: isUrl ? v : "",
      followers: "",
      enabled: true,
    };
  });
}

/* ── Punto d'ingresso ────────────────────────────────────────────────────── */

/**
 * Scarica tutto ciò che il database offre e lo traduce nel modello SiteData.
 * Ritorna solo le sezioni ottenute con successo: il resto resta ai demo.
 */
export async function fetchBackend(): Promise<Partial<SiteData>> {
  const [albums, images, dates, posts, socials] = await Promise.all([
    j<ApiAlbum[]>("/api/albums"),
    j<ApiImage[]>("/api/gallery/images?all=1"),
    j<ApiTourDate[]>("/api/tour-dates"),
    j<ApiSocialPost[]>("/api/social/posts"),
    j<ApiSocialConfig>("/api/social-config"),
  ]);

  const out: Partial<SiteData> = {};

  if (albums) {
    const mapped = mapAlbums(albums);
    out.products = mapped.products;
    out.tracks = mapped.tracks;
  }
  if (images) out.gallery = mapImages(images);
  if (dates) out.events = mapDates(dates);
  if (posts) out.posts = mapPosts(posts);
  const sm = mapSocials(socials);
  if (sm) out.socials = sm;

  return out;
}
