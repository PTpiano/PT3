import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  duration: string;
}

function extractChannelId(url: string): string | null {
  // Handle various YouTube URL formats
  // https://www.youtube.com/@peppetaglieri
  // https://www.youtube.com/channel/UCxxxxxx
  // https://www.youtube.com/c/ChannelName
  
  const handleMatch = url.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) return null; // Need to resolve handle to channel ID
  
  const channelMatch = url.match(/youtube\.com\/channel\/([\w-]+)/);
  if (channelMatch) return channelMatch[1];
  
  const customMatch = url.match(/youtube\.com\/c\/([\w.-]+)/);
  if (customMatch) return null; // Need to resolve custom URL
  
  return null;
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2] ? match[2].padStart(h ? 2 : 1, '0') : (h ? '00' : '0');
  const s = match[3] ? match[3].padStart(2, '0') : '00';
  return `${h}${m}:${s}`;
}

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key not configured', videos: [] },
      { status: 200 }
    );
  }

  try {
    // Read the social config to get the YouTube channel URL
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'data', 'social-config.json');
    
    let channelUrl = '';
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      channelUrl = configData.youtube || '';
    } catch {
      return NextResponse.json({ videos: [] });
    }

    if (!channelUrl) {
      return NextResponse.json({ videos: [] });
    }

    // Step 1: Resolve the channel handle/URL to a channel ID
    let channelId = extractChannelId(channelUrl);
    
    if (!channelId) {
      // Try to resolve @handle to channel ID using search
      const handleMatch = channelUrl.match(/@([\w.-]+)/);
      const searchTerm = handleMatch ? handleMatch[1] : channelUrl.split('/').pop() || '';
      
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(searchTerm)}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        return NextResponse.json({ videos: [] });
      }
      
      channelId = searchData.items[0].snippet.channelId;
    }

    // Step 2: Get the uploads playlist ID
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const channelsRes = await fetch(channelsUrl);
    const channelsData = await channelsRes.json();
    
    if (!channelsData.items || channelsData.items.length === 0) {
      return NextResponse.json({ videos: [] });
    }
    
    const uploadsPlaylistId = channelsData.items[0].contentDetails.relatedPlaylists.uploads;
    
    // Step 3: Get the latest videos from the uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${uploadsPlaylistId}&key=${apiKey}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    // Step 4: Get video details (stats + content details for duration)
    const videoIds = playlistData.items
      .map((item: any) => item.snippet.resourceId.videoId)
      .join(',');
    
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`;
    const videosRes = await fetch(videosUrl);
    const videosData = await videosRes.json();

    const videos: YouTubeVideo[] = (videosData.items || []).map((video: any) => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description?.substring(0, 200) || '',
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      publishedAt: video.snippet.publishedAt,
      viewCount: parseInt(video.statistics.viewCount || '0'),
      likeCount: parseInt(video.statistics.likeCount || '0'),
      duration: parseDuration(video.contentDetails.duration || ''),
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching YouTube feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube feed', videos: [] },
      { status: 500 }
    );
  }
}
