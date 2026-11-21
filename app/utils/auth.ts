import { NextRequest } from 'next/server';
import { verifyToken } from '../../lib/auth';

export interface AuthResult {
  isValid: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verifica l'autenticazione admin dal JWT nell'header Authorization.
 * Valida la firma del token server-side (lib/auth.ts): nessun token hardcoded.
 */
export async function verifyAdminAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isValid: false,
        error: 'Missing or invalid authorization header'
      };
    }

    const token = authHeader.substring(7).trim();

    if (!token || token.length < 20) {
      return {
        isValid: false,
        error: 'Invalid token'
      };
    }

    const payload = await verifyToken(token, 'access');

    if (!payload) {
      return {
        isValid: false,
        error: 'Invalid or expired token'
      };
    }

    return {
      isValid: true,
      userId: payload.sub
    };
  } catch (error) {
    console.error('Error verifying admin auth:', error);
    return {
      isValid: false,
      error: 'Authentication verification failed'
    };
  }
}

/**
 * Middleware per verificare l'autenticazione admin
 */
export function requireAdminAuth(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const authResult = await verifyAdminAuth(request);

    if (!authResult.isValid) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized. Admin access required.',
          details: authResult.error
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(request, ...args);
  };
}

/**
 * Verifica se l'utente è admin dal client-side.
 * Un token di sessione è presente (la validità reale è verificata server-side).
 */
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;

  const adminToken = localStorage.getItem('adminToken');
  return !!adminToken && adminToken.length > 20;
}

/**
 * Ritorna gli header di autenticazione per le chiamate API admin.
 */
export function getAdminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Effettua il logout admin
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adminToken');
  }
}
