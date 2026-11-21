import { query, queryOne } from "./db";

/**
 * Lettura/scrittura dei valori JSON in tabella `settings` (key/value).
 * Sostituisce i file data/*.json (su Vercel il filesystem è read-only).
 */

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await queryOne<{ value: T }>(
    `SELECT value FROM settings WHERE key = $1`,
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}
