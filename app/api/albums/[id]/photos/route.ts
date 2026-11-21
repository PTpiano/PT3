import { NextRequest, NextResponse } from 'next/server';
import { getAlbumPhotos } from '../../../../utils/albumService';
import { createAlbumPhoto } from '../../../../utils/albumServiceAdmin';
import { verifyAdminAuth } from '../../../../utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: albumId } = await params;
    const photos = await getAlbumPhotos(albumId);

    return NextResponse.json(photos);
  } catch (error) {
    console.error('Error fetching album photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch album photos' },
      { status: 500 }
    );
  }
}

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

    const { id: albumId } = await params;
    const body = await request.json();

    const photoData = {
      album_id: albumId,
      photo_url: body.photo_url,
      title: body.title,
      description: body.description,
      category: body.category || 'OTHER',
      sort_order: body.sort_order || 0,
    };

    const newPhoto = await createAlbumPhoto(photoData);

    return NextResponse.json(newPhoto, { status: 201 });
  } catch (error) {
    console.error('Error creating album photo:', error);
    return NextResponse.json(
      { error: 'Failed to create album photo' },
      { status: 500 }
    );
  }
}
