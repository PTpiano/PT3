/**
 * Helper per i video della galleria.
 *
 * Le miniature YouTube non hanno tutte la stessa disponibilità: la
 * qualità `maxresdefault`, per esempio, esiste solo per i video ad alta
 * risoluzione e restituisce 404 per tutti gli altri. Qui viene usata una
 * catena di fallback, finché non si trova un'immagine realmente visibile.
 */

export type VideoProvider = "youtube" | "vimeo" | "file";

export interface VideoMeta {
  provider: VideoProvider;
  videoId: string;
  embed: string;
  src: string;
  thumbnail: string;
}

/** Estrae l'id di un video YouTube da watch, youtu.be, shorts, live o embed. */
export function youtubeId(url: string): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
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
  const m = (url || "").trim().match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function youtubeThumb(id: string, quality: "max" | "sd" | "hq" | "mq" | "default" = "hq"): string {
  return `https://img.youtube.com/vi/${id}/${quality}default.jpg`;
}

/** Catena di miniature da provare quando una qualità non esiste. */
export function youtubeThumbChain(id: string): string[] {
  // `hq` esiste per ogni video: è il primo tentativo. Le qualità minori
  // sono i fallback; `max` viene escluso perché non esiste sempre.
  return [
    youtubeThumb(id, "hq"),
    youtubeThumb(id, "mq"),
    youtubeThumb(id, "default"),
  ];
}

/** Miniatura garantita per un URL YouTube. */
export function thumbnailForVideoUrl(url: string): string {
  const id = youtubeId(url);
  return id ? youtubeThumb(id, "hq") : "";
}

/** URL di incorporamento per YouTube e Vimeo. */
export function videoEmbedUrl(url: string): string {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}`;
  return url;
}

/** Riconosce la fonte del video e prepara i dati per il player. */
export function parseVideoUrl(url: string): VideoMeta | null {
  const raw = (url || "").trim();
  if (!raw) return null;

  const yt = youtubeId(raw);
  if (yt) {
    return {
      provider: "youtube",
      videoId: yt,
      embed: videoEmbedUrl(raw),
      src: raw,
      thumbnail: youtubeThumb(yt, "hq"),
    };
  }

  const vm = vimeoId(raw);
  if (vm) {
    return {
      provider: "vimeo",
      videoId: vm,
      embed: videoEmbedUrl(raw),
      src: raw,
      thumbnail: "",
    };
  }

  if (/^https?:\/\//i.test(raw)) {
    return {
      provider: "file",
      videoId: "",
      embed: raw,
      src: raw,
      thumbnail: "",
    };
  }

  return null;
}

/**
 * Prossime miniature da tentare dopo un errore di caricamento.
 * Restituisce null se l'URL non è una miniatura YouTube.
 */
export function thumbnailFallbackChain(src: string): string[] | null {
  const m = (src || "").match(
    /(?:img|i)\.youtube\.com\/vi\/([A-Za-z0-9_-]{6,})\/([a-z]+)default\.jpg/i
  );
  if (!m) return null;
  const chain = youtubeThumbChain(m[1]);
  const index = chain.indexOf(src);
  return index >= 0 ? chain.slice(index + 1) : chain;
}
