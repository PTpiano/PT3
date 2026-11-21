import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { verifyAdminAuth } from "../../utils/auth";

interface TourDate {
  id?: string;
  date: string;
  venue: string;
  city: string;
  time: string;
  ticketLink: string;
}

export async function GET() {
  try {
    const rows = await query<{
      id: string;
      date: string;
      venue: string;
      city: string;
      time: string;
      ticket_link: string | null;
    }>(`SELECT * FROM tour_dates ORDER BY date ASC`);

    const formatted = rows.map((item) => ({
      id: item.id,
      date: item.date,
      venue: item.venue,
      city: item.city,
      time: item.time,
      ticketLink: item.ticket_link,
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error reading tour dates:", error);
    return NextResponse.json(
      { error: "Failed to read tour dates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  const dates: TourDate[] = await request.json();

  if (!Array.isArray(dates)) {
    return NextResponse.json(
      { error: "Data must be an array of tour dates" },
      { status: 400 }
    );
  }

  try {
    // Sostituzione completa: svuota e reinserisci (come faceva con Supabase)
    await query(`DELETE FROM tour_dates`);

    for (const d of dates) {
      await query(
        `INSERT INTO tour_dates (date, venue, city, time, ticket_link)
         VALUES ($1, $2, $3, $4, $5)`,
        [d.date, d.venue, d.city, d.time, d.ticketLink ?? null]
      );
    }

    return NextResponse.json({ success: true, source: "postgres" });
  } catch (error) {
    console.error("Error saving tour dates:", error);
    return NextResponse.json(
      { error: "Failed to save tour dates" },
      { status: 500 }
    );
  }
}
