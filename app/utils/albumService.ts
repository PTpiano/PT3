import { query, queryOne } from "../../lib/db";
import { parseShopConfig, type ShopConfig } from "../../lib/shop";

// ⚠️ Modulo SERVER-ONLY di fatto: usa PostgreSQL diretto via lib/db.
// I componenti client devono usare fetch("/api/albums...") — vedi
// app/admin/albums/page.tsx.

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

export interface Album {
  id: string;
  title: string;
  artist: string;
  description?: string;
  cover_url?: string;
  back_cover_url?: string;
  release_date?: string;
  year?: number;
  genre?: string;
  duration?: number;
  is_featured: boolean;
  is_latest: boolean;
  spotify_url?: string;
  apple_music_url?: string;
  bandcamp_url?: string;
  youtube_url?: string;
  soundcloud_url?: string;
  created_at: string;
  updated_at: string;
  tracks?: Track[];
  photos?: AlbumPhoto[];
  // Store fields
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
  /** false = bozza: l'album non compare nello shop pubblico. */
  published?: boolean;
  /** Configurazione shop completa (formati attivi, prezzi, file). */
  shop_config?: ShopConfig | null;
}

const ALBUM_COLUMNS = `id, title, artist, description, cover_url, back_cover_url,
  release_date, year, genre, duration, is_featured, is_latest,
  spotify_url, apple_music_url, bandcamp_url, youtube_url, soundcloud_url,
  price_cd, price_vinyl, price_digital, price_hires, price_tape,
  stock_cd, stock_vinyl, stock_tape, is_on_offer, discount_percent,
  published, shop_config,
  created_at, updated_at`;

function withRelations(album: any, tracks: any[], photos: any[]): Album {
  return {
    ...album,
    is_featured: !!album.is_featured,
    is_latest: !!album.is_latest,
    published: album.published === null || album.published === undefined
      ? true
      : !!album.published,
    shop_config: parseShopConfig(album.shop_config),
    tracks,
    photos,
  };
}

async function attachRelations(albums: any[]): Promise<Album[]> {
  if (albums.length === 0) return [];
  const ids = albums.map((a) => a.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

  const [tracks, photos] = await Promise.all([
    query<any>(
      `SELECT * FROM tracks WHERE album_id IN (${placeholders}) ORDER BY track_number ASC`,
      ids
    ),
    query<any>(
      `SELECT * FROM album_photos WHERE album_id IN (${placeholders}) ORDER BY sort_order ASC NULLS FIRST`,
      ids
    ),
  ]);

  const tracksBy = new Map<string, any[]>();
  for (const t of tracks) {
    const list = tracksBy.get(t.album_id) ?? [];
    list.push(t);
    tracksBy.set(t.album_id, list);
  }
  const photosBy = new Map<string, any[]>();
  for (const p of photos) {
    const list = photosBy.get(p.album_id) ?? [];
    list.push(p);
    photosBy.set(p.album_id, list);
  }

  return albums.map((a) => withRelations(a, tracksBy.get(a.id) ?? [], photosBy.get(a.id) ?? []));
}

// Get all albums
export async function getAlbums(): Promise<Album[]> {
  const rows = await query(
    `SELECT ${ALBUM_COLUMNS} FROM albums ORDER BY release_date DESC NULLS LAST`
  );
  return attachRelations(rows);
}

// Get album by ID
export async function getAlbum(id: string): Promise<Album | null> {
  const album = await queryOne(`SELECT ${ALBUM_COLUMNS} FROM albums WHERE id = $1`, [id]);
  if (!album) return null;
  const [withRel] = await attachRelations([album]);
  return withRel;
}

// Get album photos
export async function getAlbumPhotos(albumId: string): Promise<AlbumPhoto[]> {
  return query(
    `SELECT * FROM album_photos WHERE album_id = $1 ORDER BY sort_order ASC NULLS FIRST`,
    [albumId]
  );
}

// Get latest release
export async function getLatestRelease(): Promise<Album | null> {
  const album = await queryOne(
    `SELECT ${ALBUM_COLUMNS} FROM albums WHERE is_latest = true LIMIT 1`
  );
  if (!album) return null;
  const [withRel] = await attachRelations([album]);
  return withRel;
}

// Get featured album
export async function getFeaturedAlbum(): Promise<Album | null> {
  const album = await queryOne(
    `SELECT ${ALBUM_COLUMNS} FROM albums WHERE is_featured = true LIMIT 1`
  );
  if (!album) return null;
  const [withRel] = await attachRelations([album]);
  return withRel;
}

// Get tracks by album
export async function getTracksByAlbum(albumId: string): Promise<Track[]> {
  return query(
    `SELECT * FROM tracks WHERE album_id = $1 ORDER BY track_number ASC`,
    [albumId]
  );
}

// Get featured tracks (is_featured = true), con album per cover/titolo
export async function getFeaturedTracks(): Promise<(Track & { album?: Album | null })[]> {
  const tracks = await query(
    `SELECT t.*, a.id AS album_id_ref, a.title AS album_title, a.artist AS album_artist,
            a.cover_url AS album_cover_url, a.spotify_url AS album_spotify_url,
            a.apple_music_url AS album_apple_music_url, a.bandcamp_url AS album_bandcamp_url,
            a.youtube_url AS album_youtube_url, a.soundcloud_url AS album_soundcloud_url,
            a.is_featured AS album_is_featured, a.is_latest AS album_is_latest,
            a.release_date AS album_release_date, a.year AS album_year,
            a.genre AS album_genre, a.created_at AS album_created_at, a.updated_at AS album_updated_at
     FROM tracks t
     LEFT JOIN albums a ON a.id = t.album_id
     WHERE t.is_featured = true
     ORDER BY t.track_number ASC`
  );

  // Fallback: se la colonna is_featured non ha risultati, ritorna tutte le tracce
  // con audio, così l'hero può comunque riprodurle.
  const source =
    tracks.length > 0
      ? tracks
      : await query(
          `SELECT t.*, a.id AS album_id_ref, a.title AS album_title, a.artist AS album_artist,
                  a.cover_url AS album_cover_url, a.spotify_url AS album_spotify_url,
                  a.apple_music_url AS album_apple_music_url, a.bandcamp_url AS album_bandcamp_url,
                  a.youtube_url AS album_youtube_url, a.soundcloud_url AS album_soundcloud_url,
                  a.is_featured AS album_is_featured, a.is_latest AS album_is_latest,
                  a.release_date AS album_release_date, a.year AS album_year,
                  a.genre AS album_genre, a.created_at AS album_created_at, a.updated_at AS album_updated_at
           FROM tracks t
           LEFT JOIN albums a ON a.id = t.album_id
           ORDER BY t.track_number ASC`
        );

  return source.map((row: any) => {
    const { album_id_ref, ...rest } = row;
    const album = album_id_ref
      ? {
          id: album_id_ref,
          title: row.album_title,
          artist: row.album_artist,
          cover_url: row.album_cover_url,
          spotify_url: row.album_spotify_url,
          apple_music_url: row.album_apple_music_url,
          bandcamp_url: row.album_bandcamp_url,
          youtube_url: row.album_youtube_url,
          soundcloud_url: row.album_soundcloud_url,
          is_featured: !!row.album_is_featured,
          is_latest: !!row.album_is_latest,
          release_date: row.album_release_date,
          year: row.album_year,
          genre: row.album_genre,
          created_at: row.album_created_at,
          updated_at: row.album_updated_at,
        } as Album
      : null;
    return { ...rest, album };
  });
}
