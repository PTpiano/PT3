import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/utils/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET all social posts
export async function GET() {
  try {
    const data = await query(
      'SELECT * FROM social_posts ORDER BY created_at DESC'
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching social posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social posts' },
      { status: 500 }
    );
  }
}

// POST a new social post
async function handlePOST(request: Request) {
  const body = await request.json();

  try {
    const data = await query(
      `INSERT INTO social_posts (
         platform, post_type, title, caption, image_url, thumbnail_url,
         video_url, external_url, likes, comments, views, duration,
         date_text, sort_order, is_published
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        body.platform,
        body.post_type,
        body.title ?? null,
        body.caption ?? null,
        body.image_url ?? null,
        body.thumbnail_url ?? null,
        body.video_url ?? null,
        body.external_url ?? null,
        body.likes || 0,
        body.comments || 0,
        body.views ?? null,
        body.duration ?? null,
        body.date_text ?? null,
        body.sort_order || 0,
        body.is_published !== undefined ? body.is_published : true,
      ]
    );
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error('Error creating social post:', error);
    return NextResponse.json(
      { error: 'Failed to create social post' },
      { status: 500 }
    );
  }
}

// PUT update a social post
async function handlePUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const body = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const data = await query(
      `UPDATE social_posts SET
         platform = $1, post_type = $2, title = $3, caption = $4,
         image_url = $5, thumbnail_url = $6, video_url = $7, external_url = $8,
         likes = $9, comments = $10, views = $11, duration = $12,
         date_text = $13, sort_order = $14, is_published = $15
       WHERE id = $16 RETURNING *`,
      [
        body.platform,
        body.post_type,
        body.title ?? null,
        body.caption ?? null,
        body.image_url ?? null,
        body.thumbnail_url ?? null,
        body.video_url ?? null,
        body.external_url ?? null,
        body.likes ?? 0,
        body.comments ?? 0,
        body.views ?? null,
        body.duration ?? null,
        body.date_text ?? null,
        body.sort_order ?? 0,
        body.is_published ?? true,
        id,
      ]
    );
    if (!data[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Error updating social post:', error);
    return NextResponse.json(
      { error: 'Failed to update social post' },
      { status: 500 }
    );
  }
}

// DELETE a social post
async function handleDELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await query('DELETE FROM social_posts WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting social post:', error);
    return NextResponse.json(
      { error: 'Failed to delete social post' },
      { status: 500 }
    );
  }
}

// Export handlers with admin auth check for write operations
export const POST = (request: NextRequest) =>
  requireAdminAuth(handlePOST)(request);

export const PUT = (request: NextRequest) =>
  requireAdminAuth(handlePUT)(request);

export const DELETE = (request: NextRequest) =>
  requireAdminAuth(handleDELETE)(request);
