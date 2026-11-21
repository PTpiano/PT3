import { NextResponse } from 'next/server';
import { getFeaturedTracks } from '../../../utils/albumService';

export async function GET() {
  try {
    const tracks = await getFeaturedTracks();
    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Error in GET /api/tracks/featured:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured tracks' },
      { status: 500 }
    );
  }
}
