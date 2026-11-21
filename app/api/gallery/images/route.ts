import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { verifyAdminAuth } from '../../../utils/auth';
import { normalizeThumbnailUrl, resolveVideo } from '../../../../lib/video';

/**
 * GET /api/gallery/images
 *
 * Lettura pubblica dell'archivio fotografico.
 * Serve alla pagina /galleria.
 *
 *   ?folder=<uuid>   solo le immagini di una cartella
 *   ?type=image|video
 *   ?limit=<n>       default 200, max 500
 *   ?all=1           ignora il limite (tutte le righe)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const folder = searchParams.get('folder');
  const type = searchParams.get('type');
  const all = searchParams.get('all') === '1';
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (folder) {
      params.push(folder);
      conditions.push(`folder_id = $${params.length}`);
    }
    if (type === 'image' || type === 'video') {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = all ? '' : `LIMIT ${limit}`;

    const rows = await query<{
      id: string;
      src: string;
      type?: string | null;
      video_url?: string | null;
    }>(
      `SELECT * FROM images ${where} ORDER BY date DESC ${limitClause}`,
      params
    );

    // Alcune miniature salvate in passato puntano a `maxresdefault`, che
    // YouTube espone solo per i video ad alta risoluzione. La risposta
    // usa sempre una qualità esistente, così la miniatura è visibile.
    const normalized = rows.map((row) => ({
      ...row,
      src:
        row.type === 'video'
          ? normalizeThumbnailUrl(row.src, row.video_url)
          : row.src,
    }));
    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error reading images:', error);
    return NextResponse.json({ error: 'Failed to read images' }, { status: 500 });
  }
}

/**
 * Compone la riga da salvare quando è un video.
 *
 * La miniatura non la decide il browser: viene ricalcolata dal server,
 * così non si salvano link a miniature inesistenti (per YouTube la
 * qualità `maxres` non esiste per tutti i video e restituisce 404).
 */
async function buildVideoFields(body: {
  src?: string | null;
  type?: string | null;
  video_url?: string | null;
}) {
  const videoUrl = (body.video_url ?? '').trim();
  if (!videoUrl) return { type: body.type ?? 'image', video_url: null, src: body.src ?? null };

  const meta = await resolveVideo(videoUrl);
  const current = (body.src ?? '').trim();

  // Una miniatura personalizzata viene conservata. Se invece manca o è
  // una qualità YouTube inesistente, ne viene scelta una sempre valida.
  const src = normalizeThumbnailUrl(current, videoUrl) || meta?.thumbnail || '';

  return {
    type: 'video',
    video_url: videoUrl,
    src,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const src = body.src;
    const category = body.category ?? 'LIVE';
    const title = body.title;
    const date = body.date;
    if ((!src && !body.video_url) || !title || !date) {
      return NextResponse.json(
        { error: 'src (o video_url), title e date sono richiesti' },
        { status: 400 }
      );
    }

    const video = await buildVideoFields(body);
    if (!video.src) {
      return NextResponse.json(
        { error: 'Serve una miniatura: caricala o indica un video YouTube/Vimeo.' },
        { status: 400 }
      );
    }

    const rows = await query(
      `INSERT INTO images (src, category, title, description, date, folder_id, featured, type, video_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        video.src,
        category,
        title,
        body.description ?? null,
        date,
        body.folder_id ?? null,
        body.featured ?? false,
        video.type,
        video.video_url,
      ]
    );

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error creating image:', error);
    return NextResponse.json({ error: 'Failed to create image' }, { status: 500 });
  }
}
