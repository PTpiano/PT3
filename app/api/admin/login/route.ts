import { NextRequest, NextResponse } from 'next/server';
import { signAccessToken, signRefreshToken } from '../../../../lib/auth';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

/** Confronto a tempo costante per le credenziali admin. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  try {
    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Login non configurato (ADMIN_EMAIL/ADMIN_PASSWORD mancanti)' },
        { status: 500 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password richieste' },
        { status: 400 }
      );
    }

    const emailOk = safeEqual(
      String(email).toLowerCase().trim(),
      adminEmail.toLowerCase()
    );
    const passwordOk = safeEqual(String(password), adminPassword);

    if (!emailOk || !passwordOk) {
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await signAccessToken(adminEmail);
    const refreshToken = await signRefreshToken(adminEmail);

    return NextResponse.json({
      access_token: token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      user: {
        id: 'admin',
        email: adminEmail,
      },
    });
  } catch (error) {
    console.error('Error in admin login:', error);
    return NextResponse.json(
      { error: 'Errore durante il login' },
      { status: 500 }
    );
  }
}
