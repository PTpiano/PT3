import { NextRequest, NextResponse } from 'next/server';
import { getLivePerformances, createLivePerformance, CreateLivePerformanceData } from '../../utils/contentService';
import { verifyAdminAuth } from '../../utils/auth';

export async function GET() {
  try {
    const performances = await getLivePerformances();
    return NextResponse.json(performances);
  } catch (error) {
    console.error('Error in GET /api/live-performances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live performances' },
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
    console.log('Received live performance data:', body);

    const performanceData: CreateLivePerformanceData = {
      title: body.title,
      description: body.description,
      date: body.date,
      venue: body.venue,
      thumbnail_url: body.thumbnail_url || body.thumbnailUrl,
      video_url: body.video_url || body.videoUrl,
      duration: body.duration,
      is_featured: body.is_featured || false,
    };

    console.log('Processed live performance data:', performanceData);

    const performance = await createLivePerformance(performanceData);
    
    if (!performance) {
      return NextResponse.json(
        { error: 'Failed to create live performance' },
        { status: 500 }
      );
    }

    return NextResponse.json(performance, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/live-performances:', error);
    return NextResponse.json(
      { error: 'Failed to create live performance' },
      { status: 500 }
    );
  }
}
