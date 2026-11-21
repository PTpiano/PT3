/**
 * Auth admin basato su JWT firmati (jose, HS256) — sostituisce Supabase Auth.
 *
 * - Il login (app/api/admin/login) verifica ADMIN_EMAIL/ADMIN_PASSWORD
 *   e rilascia un access token (7 giorni) + refresh token (30 giorni).
 * - verifyAdminAuth valida la firma server-side: nessun token hardcoded.
 * - Il client (localStorage: adminToken/adminRefreshToken/adminTokenExpiry)
 *   usa lo stesso schema di prima: nessuna UI da cambiare.
 */

import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Fallback derivato dalle credenziali admin: in produzione
    // AUTH_SECRET va sempre definito in env.
    const fallback =
      process.env.ADMIN_PASSWORD || "nocturne-dev-secret-change-me";
    return encoder.encode(fallback);
  }
  return encoder.encode(secret);
}

const ACCESS_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL = "30d";

export interface TokenPayload {
  sub: string;
  email: string;
  typ: "access" | "refresh";
  [key: string]: unknown;
}

export async function signAccessToken(email: string): Promise<{
  token: string;
  expiresAt: number; // unix seconds
}> {
  const token = await new SignJWT({ email, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());

  // Decodifica per leggere l'scadenza esatta
  const { payload } = await jwtVerify(token, getSecret());
  return { token, expiresAt: (payload.exp as number) ?? 0 };
}

export async function signRefreshToken(email: string): Promise<string> {
  return new SignJWT({ email, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getSecret());
}

/** Verifica un token. Ritorna il payload o null. */
export async function verifyToken(
  token: string,
  expectedTyp: "access" | "refresh" = "access"
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== expectedTyp) return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/** Rilascia un nuovo access token a partire da un refresh token valido. */
export async function rotateAccessToken(
  refreshToken: string
): Promise<{ token: string; expiresAt: number } | null> {
  const payload = await verifyToken(refreshToken, "refresh");
  if (!payload) return null;
  return signAccessToken(payload.email);
}
