/**
 * Layer database unificato — PostgreSQL.
 *
 * - Se DATABASE_URL è presente (Vercel/Neon/qualsiasi Postgres): usa `pg`.
 * - Altrimenti (sviluppo locale senza Postgres installato): usa PGlite,
 *   un Postgres in-process (WASM) con dati persistiti in .data/pglite/.
 *
 * API: query(sql, params) → { rows } — stessa forma di pg.
 */

import fs from "node:fs";
import path from "node:path";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

type DbHandle = {
  query: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<T>>;
};

const globalForDb = globalThis as unknown as {
  __dbHandle?: DbHandle;
  __pgPool?: import("pg").Pool;
};

function createPgHandle(): DbHandle {
  // import dinamico: `pg` non deve finire nel bundle client
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("pg") as typeof import("pg");
  const pool =
    globalForDb.__pgPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      // Neon/Supabase-style poolers richiedono SSL; localhost no.
      ssl: process.env.DATABASE_URL?.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
  globalForDb.__pgPool = pool;
  return {
    query: async <T>(text: string, params?: unknown[]) => {
      const res = await pool.query(text, params);
      return { rows: res.rows as T[] };
    },
  };
}

async function createPgliteHandle(): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;

  // Applica lo schema se le tabelle non esistono ancora
  const check = await db.query<{ t: string | null }>(
    "SELECT to_regclass('public.albums') AS t"
  );
  if (!check.rows[0]?.t) {
    const schema = fs.readFileSync(
      path.join(process.cwd(), "db", "schema.sql"),
      "utf8"
    );
    await db.exec(schema);
  }

  return {
    query: async <T>(text: string, params?: unknown[]) => {
      const res = await db.query<T>(text, params);
      return { rows: res.rows };
    },
  };
}

export async function getDb(): Promise<DbHandle> {
  if (globalForDb.__dbHandle) return globalForDb.__dbHandle;

  const handle = process.env.DATABASE_URL
    ? createPgHandle()
    : await createPgliteHandle();

  await runMigrations(handle);
  globalForDb.__dbHandle = handle;

  return handle;
}

/** Esegue una query e ritorna le righe. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(text, params);
  return res.rows;
}

/** Esegue una query e ritorna la prima riga (o null). */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Migrazioni leggere, idempotenti.
 *
 * Lo schema.sql viene applicato solo quando le tabelle non esistono
 * (PGlite locale). Su un Postgres già popolato le colonne nuove
 * mancano: le aggiungiamo qui con IF NOT EXISTS, che è sicuro da
 * rilanciare a ogni avvio e non tocca i dati.
 */
const MIGRATIONS: { label: string; sql: string }[] = [
  {
    label: "albums.published",
    sql: "ALTER TABLE albums ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE",
  },
  {
    label: "albums.shop_config",
    sql: "ALTER TABLE albums ADD COLUMN IF NOT EXISTS shop_config JSONB",
  },
  {
    label: "tracks.published",
    sql: "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE",
  },
];

async function runMigrations(db: DbHandle): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await db.query(m.sql);
    } catch (err) {
      // Non bloccare il boot: una migrazione fallita non deve impedire
      // al sito di funzionare con lo schema preesistente.
      console.error(`Migrazione "${m.label}" fallita:`, err);
    }
  }
}
