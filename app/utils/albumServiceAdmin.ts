import "server-only";
import { query, queryOne } from "../../lib/db";
import { type ShopConfig } from "../../lib/shop";

// ⚠️ MODULO SERVER-ONLY — mai importare da componenti client.
// Le scritture usano PostgreSQL diretto (lib/db).
// Le route che le chiamano devono prima verificare verifyAdminAuth.

export interface Track {
  id: string;
  album_id: string;
  title: string;
  duration: number | null;
  track_number: number;
  audio_url?: string | null;
  lyrics?: string;
  is_featured?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface AlbumPhoto {
  id: string;
  album_id: string;
  photo_url: string;
  title?: string;
  description?: string;
  category: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlbumData {
  title: string;
  artist?: string;
  description?: string;
  cover_url?: string;
  back_cover_url?: string;
  release_date?: string;
  year?: number;
  genre?: string;
  duration?: number;
  is_featured?: boolean;
  is_latest?: boolean;
  spotify_url?: string;
  apple_music_url?: string;
  bandcamp_url?: string;
  youtube_url?: string;
  soundcloud_url?: string;
  price_cd?: number;
  price_vinyl?: number;
  price_digital?: number;
  price_hires?: number;
  price_tape?: number;
  stock_cd?: number;
  stock_vinyl?: number;
  stock_tape?: number;
  is_on_offer?: boolean;
  discount_percent?: number;
  published?: boolean;
  shop_config?: ShopConfig | null;
  tracks?: any[];
}

export interface CreateTrackData {
  album_id: string;
  title: string;
  duration?: number;
  track_number: number;
  audio_url?: string;
  lyrics?: string;
  is_featured?: boolean;
  published?: boolean;
}

/** Costruisce UPDATE dinamico dai campi presenti (esclusi id/created_at). */
function buildUpdate(
  table: string,
  updates: Record<string, unknown>,
  id: string,
  allowed?: readonly string[]
): { text: string; params: unknown[] } {
  const keys = Object.keys(updates).filter(
    (k) =>
      k !== "id" &&
      k !== "created_at" &&
      k !== "updated_at" &&
      updates[k] !== undefined &&
      (!allowed || allowed.includes(k))
  );
  if (keys.length === 0) {
    return { text: `SELECT * FROM ${table} WHERE id = $1`, params: [id] };
  }
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  return {
    text: `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    params: [...keys.map((k) => updates[k]), id],
  };
}

/**
 * Colonne scrivibili di `albums`. Una whitelist, non un elenco libero:
 * i nomi delle colonne finiscono nella SQL, e le chiavi arrivano dal body
 * della richiesta — senza filtro sarebbero injection.
 */
const ALBUM_WRITABLE = [
  "title",
  "artist",
  "description",
  "cover_url",
  "back_cover_url",
  "release_date",
  "year",
  "genre",
  "duration",
  "is_featured",
  "is_latest",
  "spotify_url",
  "apple_music_url",
  "bandcamp_url",
  "youtube_url",
  "soundcloud_url",
  "price_cd",
  "price_vinyl",
  "price_digital",
  "price_hires",
  "price_tape",
  "stock_cd",
  "stock_vinyl",
  "stock_tape",
  "is_on_offer",
  "discount_percent",
  "published",
  "shop_config",
] as const;

// Album Photos Functions
export async function createAlbumPhoto(
  photoData: Omit<AlbumPhoto, "id" | "created_at" | "updated_at">
): Promise<AlbumPhoto> {
  const { album_id, photo_url, title, description, category, sort_order } = photoData;
  const rows = await query<AlbumPhoto>(
    `INSERT INTO album_photos (album_id, photo_url, title, description, category, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [album_id, photo_url, title ?? null, description ?? null, category ?? null, sort_order ?? 0]
  );
  return rows[0];
}

export async function updateAlbumPhoto(id: string, updates: Partial<AlbumPhoto>): Promise<AlbumPhoto> {
  const { text, params } = buildUpdate("album_photos", updates, id);
  const rows = await query<AlbumPhoto>(text, params);
  if (!rows[0]) throw new Error("Album photo not found");
  return rows[0];
}

export async function deleteAlbumPhoto(id: string): Promise<void> {
  await query(`DELETE FROM album_photos WHERE id = $1`, [id]);
}

// Create album
export async function createAlbum(albumData: CreateAlbumData): Promise<any> {
  const { tracks, ...data } = albumData;

  const insertData = {
    title: data.title,
    artist: data.artist || "Peppe Taglieri",
    description: data.description || null,
    cover_url: data.cover_url || null,
    back_cover_url: data.back_cover_url || null,
    release_date: data.release_date || null,
    year: data.year ?? null,
    genre: data.genre || null,
    duration: data.duration ?? null,
    is_featured: data.is_featured ?? false,
    is_latest: data.is_latest ?? false,
    spotify_url: data.spotify_url || null,
    apple_music_url: data.apple_music_url || null,
    bandcamp_url: data.bandcamp_url || null,
    youtube_url: data.youtube_url || null,
    soundcloud_url: data.soundcloud_url || null,
    published: data.published === undefined ? true : !!data.published,
    shop_config: data.shop_config ? JSON.stringify(data.shop_config) : null,
  };

  const keys = Object.keys(insertData);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await query(
    `INSERT INTO albums (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    keys.map((k) => (insertData as any)[k])
  );
  const album = rows[0];

  if (tracks && tracks.length > 0) {
    // I brani senza file audio restano comunque nell'album: il brano esiste
    // (titolo, durata, numero) anche se il file va caricato dopo.
    const tracksData = tracks.map((track, index) => ({
      album_id: album.id,
      title: track.title,
      duration:
        typeof track.duration === "string"
          ? parseDuration(track.duration)
          : (track.duration ?? null),
      track_number: index + 1,
      audio_url: track.audioUrl ?? null,
      lyrics: track.lyrics ?? null,
      published: track.published === undefined ? true : !!track.published,
    }));

    for (const t of tracksData) {
      try {
        await query(
          `INSERT INTO tracks (album_id, title, duration, track_number, audio_url, lyrics, published)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [t.album_id, t.title, t.duration, t.track_number, t.audio_url, t.lyrics, t.published]
        );
      } catch (err) {
        console.error("Error creating track:", err);
      }
    }
  }

  return album;
}

// Helper function per convertire durata da "MM:SS" a secondi
function parseDuration(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }
  return 0;
}

// Update album
export async function updateAlbum(id: string, updates: Partial<CreateAlbumData>): Promise<any> {
  // shop_config va serializzato: la colonna è JSONB.
  const payload: Record<string, unknown> = { ...updates };
  if (payload.shop_config && typeof payload.shop_config === "object") {
    payload.shop_config = JSON.stringify(payload.shop_config);
  }
  const { text, params } = buildUpdate("albums", payload, id, ALBUM_WRITABLE);
  const rows = await query(text, params);
  if (!rows[0]) throw new Error("Album not found");
  return rows[0];
}

// Delete album
export async function deleteAlbum(id: string): Promise<void> {
  await query(`DELETE FROM albums WHERE id = $1`, [id]);
}

// Set featured album (unset others)
export async function setFeaturedAlbum(id: string): Promise<void> {
  await query(`UPDATE albums SET is_featured = false WHERE is_featured = true`);
  await query(`UPDATE albums SET is_featured = true WHERE id = $1`, [id]);
}

// Set latest release (unset others)
export async function setLatestRelease(id: string): Promise<void> {
  await query(`UPDATE albums SET is_latest = false WHERE is_latest = true`);
  await query(`UPDATE albums SET is_latest = true WHERE id = $1`, [id]);
}

// Create track
export async function createTrack(trackData: CreateTrackData): Promise<Track> {
  const rows = await query<Track>(
    `INSERT INTO tracks (album_id, title, duration, track_number, audio_url, lyrics, is_featured, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      trackData.album_id,
      trackData.title,
      trackData.duration ?? null,
      trackData.track_number,
      trackData.audio_url ?? null,
      trackData.lyrics ?? null,
      trackData.is_featured ?? false,
      trackData.published === undefined ? true : !!trackData.published,
    ]
  );
  return rows[0];
}

// Update track
export async function updateTrack(id: string, updates: Partial<CreateTrackData>): Promise<Track> {
  const { text, params } = buildUpdate("tracks", updates, id);
  const rows = await query<Track>(text, params);
  if (!rows[0]) throw new Error("Track not found");
  return rows[0];
}

// Delete track
export async function deleteTrack(id: string): Promise<void> {
  await query(`DELETE FROM tracks WHERE id = $1`, [id]);
}
