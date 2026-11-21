import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '../../utils/auth';

/**
 * La vecchia versione di questa route riscriveva file sorgente del progetto
 * (data/*.json e simili). Su Vercel il filesystem è read-only/effimero:
 * i contenuti dinamici vivono ora nel database (tabella `settings`).
 *
 * Nessun componente chiama più questa route (updateFileContent è rimasto
 * in contentManager ma è inutilizzato): la route risponde 410 per sicurezza.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Admin access required.' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error:
        'Scrittura su file non supportata: i contenuti dinamici sono salvati nel database (settings).',
    },
    { status: 410 }
  );
}
