import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { verifyAdminAuth } from '../../../../utils/auth';
import { deleteFileByUrl } from '../../../../../lib/storage';

const ALLOWED = ['name', 'description', 'date', 'cover'];

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

    const keys = ALLOWED.filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
      return NextResponse.json({ success: true });
    }

    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await query(`UPDATE folders SET ${setClause} WHERE id = $${keys.length + 1}`, [
      ...keys.map((k) => updates[k]),
      id,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
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

    // I file delle immagini vanno rimossi dallo storage prima della
    // cancellazione a cascata dei record (FK ON DELETE CASCADE).
    const rows = await query<{ src: string }>(
      `SELECT src FROM images WHERE folder_id = $1`,
      [id]
    );
    await query(`DELETE FROM folders WHERE id = $1`, [id]);
    for (const r of rows) {
      try {
        await deleteFileByUrl(r.src);
      } catch (e) {
        console.error('Impossibile rimuovere il file:', r.src, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
