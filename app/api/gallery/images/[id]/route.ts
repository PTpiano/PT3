import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '../../../../../lib/db';
import { verifyAdminAuth } from '../../../../utils/auth';
import { deleteFileByUrl } from '../../../../../lib/storage';
import { normalizeThumbnailUrl, resolveVideo } from '../../../../../lib/video';

const ALLOWED = [
  'src',
  'category',
  'title',
  'description',
  'date',
  'folder_id',
  'featured',
  'type',
  'video_url',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const updates = await request.json();

    // Se è un video, la miniatura viene ricalcolata lato server: le
    // miniature YouTube non esistono tutte per ogni video (maxres → 404).
    // Una miniatura personalizzata già salvata viene invece conservata.
    if (updates.video_url) {
      const meta = await resolveVideo(String(updates.video_url));
      const existing = await queryOne<{ src?: string | null }>(
        `SELECT src FROM images WHERE id = $1`,
        [id]
      );
      const current =
        updates.src !== undefined ? String(updates.src || '') : existing?.src || '';
      const normalized = normalizeThumbnailUrl(current, String(updates.video_url));
      updates.type = 'video';
      if (!current || current.includes('img.youtube.com/vi/')) {
        updates.src = meta?.thumbnail || normalized;
      }
    }

    const keys = ALLOWED.filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
      return NextResponse.json({ success: true });
    }

    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const rows = await query(
      `UPDATE images SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => updates[k]), id]
    );

    return NextResponse.json({ success: true, image: rows[0] ?? null });
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prima recupera l'URL per cancellare anche il file dallo storage
    const rows = await query<{ src?: string }>(
      `SELECT src FROM images WHERE id = $1`,
      [id]
    );
    const src = rows[0]?.src;

    await query(`DELETE FROM images WHERE id = $1`, [id]);

    if (src) await deleteFileByUrl(src);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
