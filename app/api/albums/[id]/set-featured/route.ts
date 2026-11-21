import { NextRequest, NextResponse } from 'next/server';
import { setFeaturedAlbum } from '../../../../utils/albumServiceAdmin';
import { verifyAdminAuth } from '../../../../utils/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await setFeaturedAlbum(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/albums/[id]/set-featured:', error);
    return NextResponse.json(
      { error: 'Failed to set featured album' },
      { status: 500 }
    );
  }
}
