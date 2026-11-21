import { NextResponse } from 'next/server';
import { getLatestRelease } from '../../../utils/albumService';

export async function GET() {
  try {
    const latestAlbum = await getLatestRelease();
    return NextResponse.json(latestAlbum);
  } catch (error) {
    console.error('Error in GET /api/albums/latest:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest release' },
      { status: 500 }
    );
  }
}
