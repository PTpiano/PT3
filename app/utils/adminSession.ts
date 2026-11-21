"use client";

// Gestione della sessione admin lato browser.
// I JWT hanno scadenza lunga (7 giorni): qui centralizziamo refresh e
// validazione per evitare i 401 "accesso non autorizzato" durante gli
// upload e le modifiche. Il refresh usa /api/admin/refresh (JWT propri).

const REFRESH_MARGIN_SECONDS = 300; // rinnova quando mancano < 5 minuti

function readSession() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("adminToken");
  if (!token || token.length < 20) return null;
  return {
    token,
    refreshToken: localStorage.getItem("adminRefreshToken") || "",
    expiry: Number(localStorage.getItem("adminTokenExpiry") || 0),
  };
}

function writeSession(session: {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}) {
  localStorage.setItem("adminToken", session.access_token);
  if (session.refresh_token) {
    localStorage.setItem("adminRefreshToken", session.refresh_token);
  }
  if (session.expires_at) {
    localStorage.setItem("adminTokenExpiry", String(session.expires_at));
  }
}

/**
 * Pulisce la sessione admin dal localStorage (token, refresh token, flag UI).
 */
export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminRefreshToken");
  localStorage.removeItem("adminTokenExpiry");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("isAdmin");
}

/**
 * Rinnova il token di accesso usando il refresh token.
 * In caso di refresh token revocato/invalido pulisce la sessione e ritorna null.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const session = readSession();
  if (!session || !session.refreshToken) return null;

  try {
    const res = await fetch("/api/admin/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });

    if (!res.ok) {
      console.error("Token refresh fallito:", res.status);
      clearAdminSession();
      return null;
    }

    const data = await res.json();
    if (!data.access_token) {
      clearAdminSession();
      return null;
    }

    writeSession(data);
    return data.access_token;
  } catch (error) {
    console.error("Token refresh fallito:", error);
    return null;
  }
}

/**
 * Ritorna un token di accesso valido, rinnovandolo se prossimo alla scadenza.
 * Da chiamare PRIMA di ogni chiamata API admin (upload, salvataggi, ecc.).
 * Se la sessione non esiste o è irreparabile ritorna null.
 */
export async function ensureValidToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const session = readSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);

  // Token valido e lontano dalla scadenza → zero overhead di rete.
  if (session.expiry && now < session.expiry - REFRESH_MARGIN_SECONDS) {
    return session.token;
  }

  // Senza refresh token non possiamo rinnovarlo: ritorna quello corrente.
  if (!session.refreshToken) return session.token;

  return refreshAccessToken();
}

/**
 * Verifica completa della sessione al mount dell'app: valida il token
 * e, se irrecuperabile, effettua il logout automatico.
 * Evita la UI admin "fantasma" (edit visibile ma upload/API in errore).
 */
export async function validateAdminSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const session = readSession();
  if (!session) return false;

  // Token ancora valido localmente → ok (la firma è verificata server-side
  // a ogni chiamata API).
  const now = Math.floor(Date.now() / 1000);
  if (session.expiry && now < session.expiry) {
    return true;
  }

  // Scaduto → prova il refresh
  const refreshed = await refreshAccessToken();
  if (refreshed) return true;

  clearAdminSession();
  return false;
}
