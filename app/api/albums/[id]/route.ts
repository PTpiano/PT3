import { NextRequest, NextResponse } from 'next/server';
import { getAlbum, getAlbumPhotos, getTracksByAlbum } from '../../../utils/albumService';
import {
  updateAlbum,
  deleteAlbum,
  setFeaturedAlbum,
  setLatestRelease,
  createAlbumPhoto,
  updateAlbumPhoto,
  deleteAlbumPhoto,
  createTrack,
  updateTrack,
  deleteTrack,
} from '../../../utils/albumServiceAdmin';
import { verifyAdminAuth } from '../../../utils/auth';
import { parseShopConfig } from '../../../../lib/shop';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const album = await getAlbum(id);
    if (!album) {
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(album);
  } catch (error) {
    console.error('Error in GET /api/albums/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch album' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verifica autenticazione admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Separa le tracce e le foto dai dati dell'album e mappa i campi correttamente
    const { tracks, additionalPhotos, coverUrl, backCoverUrl, date, shop_config, shopConfig, published, ...restData } = body;

    // Mappa i campi per il database se non già presenti nei nomi corretti
    const albumData = {
      ...restData,
      cover_url: coverUrl !== undefined ? coverUrl : restData.cover_url,
      back_cover_url: backCoverUrl !== undefined ? backCoverUrl : restData.back_cover_url,
      release_date: date !== undefined ? date : restData.release_date,
      ...(shop_config !== undefined || shopConfig !== undefined
        ? { shop_config: parseShopConfig(shop_config ?? shopConfig) }
        : {}),
      ...(published !== undefined ? { published: !!published } : {}),
    };

    // Aggiorna l'album
    const album = await updateAlbum(id, albumData);

    // Se ci sono tracce da aggiornare, gestiscile
    if (tracks && Array.isArray(tracks)) {

      try {
        // Ottieni le tracce esistenti
        const existingTracks = await getTracksByAlbum(id);

        // Elimina le tracce esistenti che non sono più presenti.
        // Il confronto avviene per id quando disponibile, altrimenti per
        // titolo (compatibilità con i pannelli che non mandano gli id).
        const newTrackTitles = tracks.map(t => t.title);
        const newTrackIds = new Set(
          tracks.map(t => (typeof t.id === 'string' ? t.id : '')).filter(Boolean)
        );
        for (const existingTrack of existingTracks) {
          const keptById = newTrackIds.has(existingTrack.id);
          const keptByTitle = !newTrackIds.size && newTrackTitles.includes(existingTrack.title);
          if (!keptById && !keptByTitle) {
            await deleteTrack(existingTrack.id);
          }
        }

        // Aggiorna o crea le nuove tracce
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          // Match per id quando il client lo manda, altrimenti per titolo.
          const existingTrack =
            (typeof track.id === 'string' && existingTracks.find(t => t.id === track.id)) ||
            existingTracks.find(t => t.title === track.title);

          // Helper function per convertire durata da "MM:SS" a secondi
          const parseDuration = (duration: any): number => {
            if (duration === null || duration === undefined || duration === '') return 0;
            if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
            const text = String(duration);
            const parts = text.split(':');
            if (parts.length === 2) {
              const minutes = parseInt(parts[0], 10) || 0;
              const seconds = parseInt(parts[1], 10) || 0;
              return minutes * 60 + seconds;
            }
            return 0;
          };

          const trackData = {
            album_id: id,
            title: track.title,
            duration: parseDuration(track.duration), // Converte "3:45" in secondi
            track_number: i + 1,
            audio_url: track.audioUrl || track.audio_url || null,
            lyrics: track.lyrics ?? track.lyric ?? null,
            is_featured: !!track.isFeatured,
            published: track.published === undefined ? true : !!track.published,
          };

          if (existingTrack) {
            // Aggiorna traccia esistente
            await updateTrack(existingTrack.id, trackData);
          } else {
            // Crea nuova traccia
            await createTrack(trackData);
          }
        }
      } catch (trackError) {
        console.error('Error updating tracks:', trackError);
        // Non bloccare l'aggiornamento dell'album se le tracce falliscono
      }
    }

    // Gestisci le foto aggiuntive se presenti
    if (additionalPhotos && Array.isArray(additionalPhotos)) {
      try {
        // Ottieni le foto esistenti
        const existingPhotos = await getAlbumPhotos(id);

        // Crea un set degli ID delle foto che devono rimanere
        const photosToKeep = new Set(
          additionalPhotos
            .filter(photo => photo.isExisting && photo.id)
            .map(photo => photo.id)
        );

        // Elimina le foto che non sono più presenti
        for (const existingPhoto of existingPhotos) {
          if (!photosToKeep.has(existingPhoto.id)) {
            await deleteAlbumPhoto(existingPhoto.id);
          }
        }

        // Aggiorna o crea le foto
        for (let i = 0; i < additionalPhotos.length; i++) {
          const photo = additionalPhotos[i];

          if (photo.isExisting && photo.id) {
            // Aggiorna foto esistente
            await updateAlbumPhoto(photo.id, {
              title: photo.title || undefined,
              description: photo.description || undefined,
              category: photo.category,
              photo_url: photo.photo_url,
              sort_order: i
            });
          } else if (photo.photo_url) {
            // Crea nuova foto
            await createAlbumPhoto({
              album_id: id,
              photo_url: photo.photo_url,
              title: photo.title || undefined,
              description: photo.description || undefined,
              category: photo.category || 'OTHER',
              sort_order: i
            });
          }
        }
      } catch (photoError) {
        console.error('Error updating photos:', photoError);
        // Non bloccare l'aggiornamento dell'album se le foto falliscono
      }
    }

    return NextResponse.json(album);
  } catch (error) {
    console.error('Error in PUT /api/albums/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update album' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verifica autenticazione admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Gestisci azioni speciali
    if (body.action === 'set_featured') {
      await setFeaturedAlbum(id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'set_latest') {
      await setLatestRelease(id);
      return NextResponse.json({ success: true });
    }

    // Aggiornamento parziale normale
    const album = await updateAlbum(id, body);
    return NextResponse.json(album);
  } catch (error) {
    console.error('Error in PATCH /api/albums/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update album' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verifica autenticazione admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await deleteAlbum(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/albums/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to delete album' },
      { status: 500 }
    );
  }
}
