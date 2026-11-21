import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/utils/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET all social accounts
export async function GET() {
  try {
    const data = await query(
      'SELECT * FROM social_accounts ORDER BY sort_order ASC'
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching social accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social accounts' },
      { status: 500 }
    );
  }
}

// POST a new social account
async function handlePOST(request: Request) {
  const body = await request.json();

  try {
    const data = await query(
      `INSERT INTO social_accounts (platform, label, url, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        body.platform,
        body.label,
        body.url,
        body.sort_order || 0,
        body.is_active !== undefined ? body.is_active : true,
      ]
    );
    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error('Error creating social account:', error);
    return NextResponse.json(
      { error: 'Failed to create social account' },
      { status: 500 }
    );
  }
}

// PUT update a social account
async function handlePUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const body = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const data = await query(
      `UPDATE social_accounts
       SET platform = $1, label = $2, url = $3, sort_order = $4, is_active = $5
       WHERE id = $6 RETURNING *`,
      [
        body.platform,
        body.label,
        body.url,
        body.sort_order,
        body.is_active,
        id,
      ]
    );
    if (!data[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Error updating social account:', error);
    return NextResponse.json(
      { error: 'Failed to update social account' },
      { status: 500 }
    );
  }
}

// DELETE a social account
async function handleDELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await query('DELETE FROM social_accounts WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting social account:', error);
    return NextResponse.json(
      { error: 'Failed to delete social account' },
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
