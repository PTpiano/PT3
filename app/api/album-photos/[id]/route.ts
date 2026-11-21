import { NextRequest, NextResponse } from 'next/server';
import { updateAlbumPhoto, deleteAlbumPhoto } from '../../../utils/albumServiceAdmin';
import { verifyAdminAuth } from '../../../utils/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth server-side: solo admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: photoId } = await params;
    const body = await request.json();

    const updates = {
      photo_url: body.photo_url,
      title: body.title,
      description: body.description,
      category: body.category,
      sort_order: body.sort_order,
    };

    const updatedPhoto = await updateAlbumPhoto(photoId, updates);

    return NextResponse.json(updatedPhoto);
  } catch (error) {
    console.error('Error updating album photo:', error);
    return NextResponse.json(
      { error: 'Failed to update album photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth server-side: solo admin
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: photoId } = await params;

    await deleteAlbumPhoto(photoId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting album photo:', error);
    return NextResponse.json(
      { error: 'Failed to delete album photo' },
      { status: 500 }
    );
  }
}
