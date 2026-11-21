import { NextRequest, NextResponse } from "next/server";
import { resolveVideo } from "../../../lib/video";

/**
 * GET /api/video?url=<link>
 *
 * Risolve i metadati di un video (YouTube, Vimeo o file diretto):
 * miniatura, URL di embed e provider.
 *
 * Il pannello admin lo usa per compilare da solo la miniatura quando si
 * inserisce un video: così non capita di salvare un link a una miniatura
 * inesistente (le miniature YouTube non esistono tutte per ogni video).
 *
 * Non è un proxy aperto: il server contatta soltanto l'oEmbed di Vimeo;
 * per YouTube e per i file diretti lavora sul link ricevuto.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json({ error: "Parametro url mancante." }, { status: 400 });
  }

  try {
    const meta = await resolveVideo(url);
    if (!meta) {
      return NextResponse.json(
        { error: "Sorgente video non riconosciuta (ammessi: YouTube, Vimeo, file mp4/webm)." },
        { status: 400 }
      );
    }
    return NextResponse.json(meta);
  } catch (error) {
    console.error("Error resolving video:", error);
    return NextResponse.json({ error: "Impossibile risolvere il video." }, { status: 500 });
  }
}
