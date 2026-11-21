import { NextResponse } from 'next/server';
import { listFiles } from '../../../../lib/storage';

const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.flac', '.aac'];

// API per elencare i file audio nello storage
export async function GET() {
  try {
    const files = await listFiles('music/tracks');

    const audioFiles = files
      .filter((file) => {
        const name = file.name.toLowerCase();
        return AUDIO_EXT.some((ext) => name.endsWith(ext));
      })
      .map((file) => ({
        id: file.url,
        name: file.name,
        size: file.size,
        created_at: file.created_at,
        updated_at: file.created_at,
        url: file.url,
      }));

    return NextResponse.json({
      success: true,
      files: audioFiles,
    });
  } catch (error) {
    console.error('Error in GET /api/storage/audio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
