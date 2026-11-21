import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";

// POST /api/contact — pubblica: salva un messaggio dal form contatti
// nella tabella contact_messages.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const requestType = typeof body.type === "string" ? body.type : "booking";

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are required" },
        { status: 400 }
      );
    }

    // Validazione email di base
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO contact_messages (name, email, request_type, message, status)
       VALUES ($1, $2, $3, $4, 'new')`,
      [name, email, requestType, message]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
