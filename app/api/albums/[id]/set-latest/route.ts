import { NextRequest, NextResponse } from 'next/server';
import { setLatestRelease } from '../../../../utils/albumServiceAdmin';
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
    await setLatestRelease(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/albums/[id]/set-latest:', error);
    return NextResponse.json(
      { error: 'Failed to set latest release' },
      { status: 500 }
    );
  }
}
