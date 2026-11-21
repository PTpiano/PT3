import { NextResponse } from 'next/server';
import { getFeaturedAlbum } from '../../../utils/albumService';

export async function GET() {
  try {
    const featuredAlbum = await getFeaturedAlbum();
    return NextResponse.json(featuredAlbum);
  } catch (error) {
    console.error('Error in GET /api/albums/featured:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured album' },
      { status: 500 }
    );
  }
}
