import { NextRequest, NextResponse } from 'next/server';
import { rotateAccessToken, signRefreshToken, verifyToken } from '../../../../lib/auth';

/**
 * Rinnova l'access token a partire da un refresh token valido.
 * Chiamato dal client (adminSession.refreshAccessToken) quando il token
 * è prossimo alla scadenza.
 */
export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token || typeof refresh_token !== 'string') {
      return NextResponse.json({ error: 'Refresh token mancante' }, { status: 400 });
    }

    const rotated = await rotateAccessToken(refresh_token);

    if (!rotated) {
      return NextResponse.json(
        { error: 'Refresh token non valido o scaduto' },
        { status: 401 }
      );
    }

    // Rilascia anche un nuovo refresh token (rotazione completa)
    const payload = await verifyToken(refresh_token, 'refresh');
    const newRefresh = payload
      ? await signRefreshToken(payload.email)
      : refresh_token;

    return NextResponse.json({
      access_token: rotated.token,
      refresh_token: newRefresh,
      expires_at: rotated.expiresAt,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json({ error: 'Errore durante il refresh' }, { status: 500 });
  }
}
