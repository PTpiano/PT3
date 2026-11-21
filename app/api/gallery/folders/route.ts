import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '../../../../lib/db';
import { verifyAdminAuth } from '../../../utils/auth';

export async function GET() {
  try {
    const rows = await query(
      `SELECT * FROM folders ORDER BY date DESC NULLS LAST`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error reading folders:', error);
    return NextResponse.json({ error: 'Failed to read folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.name || !body.date) {
      return NextResponse.json(
        { error: 'name e date sono richiesti' },
        { status: 400 }
      );
    }

    const rows = await query(
      `INSERT INTO folders (name, description, date, cover)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.name, body.description ?? null, body.date, body.cover ?? null]
    );

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
