import { query, queryOne } from "../../lib/db";

// Le letture e le scritture usano PostgreSQL diretto (lib/db).
// Le route che chiamano le scritture sono già protette da verifyAdminAuth.

// Types for different content types
export interface LivePerformance {
  id: string;
  title: string;
  description?: string;
  date: string;
  venue: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudioSession {
  id: string;
  title: string;
  description?: string;
  date: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLivePerformanceData {
  title: string;
  description?: string;
  date: string;
  venue: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_featured?: boolean;
}

export interface CreateStudioSessionData {
  title: string;
  description?: string;
  date: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_featured?: boolean;
}

function buildUpdate(
  table: string,
  updates: Record<string, unknown>,
  id: string
): { text: string; params: unknown[] } {
  const keys = Object.keys(updates).filter(
    (k) => k !== "id" && k !== "created_at" && k !== "updated_at" && updates[k] !== undefined
  );
  if (keys.length === 0) {
    return { text: `SELECT * FROM ${table} WHERE id = $1`, params: [id] };
  }
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  return {
    text: `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    params: [...keys.map((k) => updates[k]), id],
  };
}

// Live Performances CRUD
export async function getLivePerformances(): Promise<LivePerformance[]> {
  try {
    return await query(
      `SELECT * FROM live_performances ORDER BY date DESC`
    );
  } catch (error) {
    console.error('Error fetching live performances:', error);
    return [];
  }
}

export async function getLivePerformance(id: string): Promise<LivePerformance | null> {
  try {
    return await queryOne(`SELECT * FROM live_performances WHERE id = $1`, [id]);
  } catch (error) {
    console.error('Error fetching live performance:', error);
    return null;
  }
}

export async function createLivePerformance(
  performanceData: CreateLivePerformanceData
): Promise<LivePerformance | null> {
  try {
    const { title, description, date, venue, thumbnail_url, video_url, duration, is_featured } =
      performanceData;
    const rows = await query<LivePerformance>(
      `INSERT INTO live_performances (title, description, date, venue, thumbnail_url, video_url, duration, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        title,
        description ?? null,
        date,
        venue,
        thumbnail_url ?? null,
        video_url ?? null,
        duration ?? null,
        is_featured ?? false,
      ]
    );
    return rows[0];
  } catch (error) {
    console.error('Error creating live performance:', error);
    return null;
  }
}

export async function updateLivePerformance(
  id: string,
  performanceData: Partial<CreateLivePerformanceData>
): Promise<LivePerformance | null> {
  try {
    const { text, params } = buildUpdate("live_performances", performanceData, id);
    const rows = await query<LivePerformance>(text, params);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Error updating live performance:', error);
    return null;
  }
}

export async function deleteLivePerformance(id: string): Promise<boolean> {
  try {
    await query(`DELETE FROM live_performances WHERE id = $1`, [id]);
    return true;
  } catch (error) {
    console.error('Error deleting live performance:', error);
    return false;
  }
}

// Studio Sessions CRUD
export async function getStudioSessions(): Promise<StudioSession[]> {
  try {
    return await query(`SELECT * FROM studio_sessions ORDER BY date DESC`);
  } catch (error) {
    console.error('Error fetching studio sessions:', error);
    return [];
  }
}

export async function getStudioSession(id: string): Promise<StudioSession | null> {
  try {
    return await queryOne(`SELECT * FROM studio_sessions WHERE id = $1`, [id]);
  } catch (error) {
    console.error('Error fetching studio session:', error);
    return null;
  }
}

export async function createStudioSession(
  sessionData: CreateStudioSessionData
): Promise<StudioSession | null> {
  try {
    const { title, description, date, thumbnail_url, video_url, duration, is_featured } = sessionData;
    const rows = await query<StudioSession>(
      `INSERT INTO studio_sessions (title, description, date, thumbnail_url, video_url, duration, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        title,
        description ?? null,
        date,
        thumbnail_url ?? null,
        video_url ?? null,
        duration ?? null,
        is_featured ?? false,
      ]
    );
    return rows[0];
  } catch (error) {
    console.error('Error creating studio session:', error);
    return null;
  }
}

export async function updateStudioSession(
  id: string,
  sessionData: Partial<CreateStudioSessionData>
): Promise<StudioSession | null> {
  try {
    const { text, params } = buildUpdate("studio_sessions", sessionData, id);
    const rows = await query<StudioSession>(text, params);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Error updating studio session:', error);
    return null;
  }
}

export async function deleteStudioSession(id: string): Promise<boolean> {
  try {
    await query(`DELETE FROM studio_sessions WHERE id = $1`, [id]);
    return true;
  } catch (error) {
    console.error('Error deleting studio session:', error);
    return false;
  }
}

// Featured content functions
export async function setFeaturedLivePerformance(id: string): Promise<boolean> {
  try {
    await query(`UPDATE live_performances SET is_featured = false WHERE is_featured = true`);
    await query(`UPDATE live_performances SET is_featured = true WHERE id = $1`, [id]);
    return true;
  } catch (error) {
    console.error('Error setting featured live performance:', error);
    return false;
  }
}

export async function setFeaturedStudioSession(id: string): Promise<boolean> {
  try {
    await query(`UPDATE studio_sessions SET is_featured = false WHERE is_featured = true`);
    await query(`UPDATE studio_sessions SET is_featured = true WHERE id = $1`, [id]);
    return true;
  } catch (error) {
    console.error('Error setting featured studio session:', error);
    return false;
  }
}

export async function getFeaturedLivePerformance(): Promise<LivePerformance | null> {
  try {
    return await queryOne(
      `SELECT * FROM live_performances WHERE is_featured = true LIMIT 1`
    );
  } catch (error) {
    console.error('Error fetching featured live performance:', error);
    return null;
  }
}

export async function getFeaturedStudioSession(): Promise<StudioSession | null> {
  try {
    return await queryOne(
      `SELECT * FROM studio_sessions WHERE is_featured = true LIMIT 1`
    );
  } catch (error) {
    console.error('Error fetching featured studio session:', error);
    return null;
  }
}
