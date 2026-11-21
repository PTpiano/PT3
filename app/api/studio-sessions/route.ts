import { NextRequest, NextResponse } from 'next/server';
import { getStudioSessions, createStudioSession, CreateStudioSessionData } from '../../utils/contentService';
import { verifyAdminAuth } from '../../utils/auth';

export async function GET() {
  try {
    const sessions = await getStudioSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error in GET /api/studio-sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studio sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Received studio session data:', body);

    const sessionData: CreateStudioSessionData = {
      title: body.title,
      description: body.description,
      date: body.date,
      thumbnail_url: body.thumbnail_url || body.thumbnailUrl,
      video_url: body.video_url || body.videoUrl,
      duration: body.duration,
      is_featured: body.is_featured || false,
    };

    console.log('Processed studio session data:', sessionData);

    const session = await createStudioSession(sessionData);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create studio session' },
        { status: 500 }
      );
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/studio-sessions:', error);
    return NextResponse.json(
      { error: 'Failed to create studio session' },
      { status: 500 }
    );
  }
}
