import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '../../../lib/storage';
import { verifyAdminAuth } from '../../utils/auth';

// Endpoint per il caricamento di file (Vercel Blob in produzione,
// public/uploads/ in sviluppo locale) — sostituisce Supabase Storage.
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const fileType = formData.get('fileType') as string;
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file provided in upload request');
      return NextResponse.json(
        { error: 'Nessun file caricato' },
        { status: 400 }
      );
    }

    // Cartella di destinazione in base al tipo di file
    let folder: string;
    switch (fileType) {
      case 'audio':
        folder = 'music/tracks';
        break;
      case 'image':
        folder = 'gallery/uploads';
        break;
      case 'album':
        folder = 'albums/covers';
        break;
      default:
        console.error('Unsupported file type:', fileType);
        return NextResponse.json(
          { error: 'Tipo di file non supportato' },
          { status: 400 }
        );
    }

    // Nome file sicuro e unico
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = `${folder}/${uniqueFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadFile(filePath, buffer, file.type || undefined);

    return NextResponse.json({
      success: true,
      fileName: uniqueFileName,
      fileUrl: publicUrl,
    });
  } catch (error) {
    console.error('Errore durante il caricamento del file:', error);
    const e = error as any;
    return NextResponse.json(
      {
        error: 'Errore durante il caricamento del file',
        details: e?.message || null,
        code: e?.code || null,
      },
      { status: 500 }
    );
  }
}
