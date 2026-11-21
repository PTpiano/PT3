/**
 * Utility per i video della galleria.
 *
 * Riconosce le fonti più comuni e ne ricava:
 *  · la miniatura (thumbnail) da mostrare nella griglia;
 *  · l'URL di embed per far partire il video nel lightbox;
 *  · l'URL diretto, per i file mp4/webm ospitati altrove.
 *
 * YouTube: le miniature hanno qualità diverse e non tutte esistono per
 * ogni video (`maxresdefault` è disponibile solo per i video in alta
 * risoluzione e risponde 404 sugli altri). Per questo la catena di
 * fallback parte da `hqdefault`, che esiste sempre.
 */

export type VideoProvider = "youtube" | "vimeo" | "file";

export interface VideoMeta {
  provider: VideoProvider;
  /** Id del video (YouTube/Vimeo) o "" per i file diretti. */
  videoId: string;
  /** URL della miniatura ("" se il video non ne ha). */
  thumbnail: string;
  /** URL da usare in un <iframe>. */
  embed: string;
  /** URL diretto del file (solo provider "file"). */
  src: string;
}

const FILE_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i;

/** Estrae l'id di un video YouTube da qualsiasi forma di link. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const raw = url.trim();
  let m = raw.match(/(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = raw.match(/(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  return null;
}

/** Estrae l'id di un video Vimeo. */
export function vimeoId(url: string): string | null {
  if (!url) return null;
  const m = url
    .trim()
    .match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * URL della miniatura YouTube per una data qualità.
 * `hq` esiste sempre; `max` solo per i video ad alta risoluzione.
 */
export function youtubeThumb(id: string, quality: "max" | "sd" | "hq" | "mq" | "default" = "hq"): string {
  return `https://img.youtube.com/vi/${id}/${quality}default.jpg`;
}

/** Miniatura garantita per un URL YouTube ("" se non è YouTube). */
export function thumbnailForVideoUrl(url: string): string {
  const id = youtubeId(url);
  return id ? youtubeThumb(id, "hq") : "";
}

/**
 * Normalizza una miniatura YouTube già salvata.
 *
 * `maxresdefault` esiste solo per una parte dei video: per gli altri
 * restituisce 404 e l'immagine non compare. In quel caso si passa alla
 * qualità `hq`, sempre disponibile.
 */
export function normalizeThumbnailUrl(src: string, videoUrl?: string | null): string {
  const current = (src || "").trim();
  const maxres = current.match(/^(https?:\/\/(?:img|i)\.youtube\.com\/vi\/[A-Za-z0-9_-]{6,})\/maxresdefault\.jpg/i);
  if (maxres) return `${maxres[1]}/hqdefault.jpg`;

  const yt = current.match(/^https?:\/\/(?:img|i)\.youtube\.com\/vi\/([A-Za-z0-9_-]{6,})\//i);
  if (yt) return youtubeThumb(yt[1], "hq");

  if (!current && videoUrl) return thumbnailForVideoUrl(videoUrl);
  return current;
}

/**
 * Le miniature YouTube da provare in ordine quando la prima non esiste.
 * Usata dal fallback onError delle <img>.
 */
export function youtubeThumbChain(id: string): string[] {
  // `hq` esiste per ogni video: è il primo tentativo. Le qualità minori
  // sono i fallback; `max` viene escluso perché non esiste sempre.
  return [
    youtubeThumb(id, "hq"),
    youtubeThumb(id, "mq"),
    youtubeThumb(id, "default"),
  ];
}

/** URL di embed YouTube (senza cookie, più leggero). */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** URL di embed Vimeo. */
export function vimeoEmbed(id: string): string {
  return `https://player.vimeo.com/video/${id}`;
}

/**
 * Riconosce un URL video e ne ricava i metadati (lato browser).
 * Per Vimeo la miniatura richiede una chiamata al server: qui resta vuota.
 */
export function parseVideoUrl(url: string): VideoMeta | null {
  const raw = (url || "").trim();
  if (!raw) return null;

  const yt = youtubeId(raw);
  if (yt) {
    return {
      provider: "youtube",
      videoId: yt,
      thumbnail: youtubeThumb(yt, "hq"),
      embed: youtubeEmbed(yt),
      src: raw,
    };
  }

  const vm = vimeoId(raw);
  if (vm) {
    return {
      provider: "vimeo",
      videoId: vm,
      thumbnail: "",
      embed: vimeoEmbed(vm),
      src: raw,
    };
  }

  if (FILE_EXT.test(raw) || /^https?:\/\//i.test(raw)) {
    return {
      provider: "file",
      videoId: "",
      thumbnail: "",
      embed: raw,
      src: raw,
    };
  }

  return null;
}

/**
 * Riconosce un URL video e ne ricava i metadati lato server.
 * Per Vimeo interroga l'oEmbed di Vimeo per ottenere la miniatura.
 * Restituisce null se la fonte non è riconosciuta.
 */
export async function resolveVideo(url: string): Promise<VideoMeta | null> {
  const meta = parseVideoUrl(url);
  if (!meta) return null;

  if (meta.provider === "vimeo") {
    try {
      const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembed, { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { thumbnail_url?: string };
        if (j.thumbnail_url) meta.thumbnail = j.thumbnail_url;
      }
    } catch {
      /* senza miniatura: l'amministratore può caricarla a mano */
    }
  }

  return meta;
}

/**
 * Se `src` è una miniatura YouTube, la catena di fallback per l'errore.
 * Restituisce null quando non c'è nulla da tentare.
 */
export function thumbFallbackChain(src: string): string[] | null {
  const m = src.match(/(?:img|i)\.youtube\.com\/vi\/([A-Za-z0-9_-]{6,})\/([a-z]+)default\.jpg/i);
  if (!m) return null;
  const chain = youtubeThumbChain(m[1]);
  const i = chain.indexOf(src);
  return i >= 0 ? chain.slice(i + 1) : chain;
}
