import { NextRequest, NextResponse } from 'next/server';
import { getAlbums } from '../../utils/albumService';
import { createAlbum, CreateAlbumData, createAlbumPhoto } from '../../utils/albumServiceAdmin';
import { verifyAdminAuth } from '../../utils/auth';
import { parseShopConfig } from '../../../lib/shop';

export async function GET(request: NextRequest) {
  try {
    // ?all=1 → anche le bozze (pannello admin). Richiede il token admin:
    // le bozze non sono contenuto pubblico.
    const wantAll = request.nextUrl.searchParams.get('all') === '1';
    if (wantAll) {
      const authResult = await verifyAdminAuth(request);
      if (!authResult.isValid) {
        return NextResponse.json(
          { error: 'Unauthorized. Admin access required.' },
          { status: 401 }
        );
      }
    }
    const albums = await getAlbums();
    const visible = wantAll ? albums : albums.filter((a) => a.published !== false);
    return NextResponse.json(visible);
  } catch (error) {
    console.error('Error in GET /api/albums:', error);
    return NextResponse.json(
      { error: 'Failed to fetch albums' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Received album data:', body);

    // Estrai l'anno dalla data di rilascio
    const releaseDate = body.date || body.release_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : new Date().getFullYear();

    const albumData: CreateAlbumData = {
      title: body.title,
      artist: body.artist || 'Peppe Taglieri',
      description: body.description,
      cover_url: body.coverUrl || body.cover_url, // Supporta entrambi i nomi
      back_cover_url: body.backCoverUrl || body.back_cover_url, // Supporta entrambi i nomi
      release_date: releaseDate, // Supporta entrambi i nomi
      year: year, // Aggiungi il campo year richiesto
      genre: body.genre || 'Jazz Fusion',
      duration: body.duration,
      is_featured: body.is_featured || false,
      is_latest: body.is_latest || false,
      spotify_url: body.spotify_url,
      apple_music_url: body.apple_music_url,
      bandcamp_url: body.bandcamp_url,
      youtube_url: body.youtube_url,
      soundcloud_url: body.soundcloud_url,
      // Configurazione shop: formati attivi, prezzi, file per formato.
      shop_config: parseShopConfig(body.shop_config ?? body.shopConfig),
      published: body.published === undefined ? true : !!body.published,
      tracks: body.tracks || [], // Aggiungi supporto per le tracce
    };

    console.log('Processed album data:', albumData);

    const album = await createAlbum(albumData);

    // Gestisci le foto aggiuntive se presenti
    if (body.additionalPhotos && Array.isArray(body.additionalPhotos) && body.additionalPhotos.length > 0) {
      console.log('Creating additional photos:', body.additionalPhotos);

      for (let i = 0; i < body.additionalPhotos.length; i++) {
        const photo = body.additionalPhotos[i];
        if (photo.photo_url) {
          try {
            await createAlbumPhoto({
              album_id: album.id,
              photo_url: photo.photo_url,
              title: photo.title || undefined,
              description: photo.description || undefined,
              category: photo.category || 'OTHER',
              sort_order: i
            });
          } catch (photoError) {
            console.error('Error creating album photo:', photoError);
            // Non bloccare la creazione dell'album per errori nelle foto
          }
        }
      }
    }

    return NextResponse.json(album, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/albums:', error);
    const e = error as any;
    return NextResponse.json(
      {
        error: 'Failed to create album',
        details: e?.message || e?.error_description || null,
        code: e?.code || null
      },
      { status: 500 }
    );
  }
}

