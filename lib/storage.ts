/**
 * Layer storage unificato.
 *
 * - Produzione (Vercel): Vercel Blob. Le credenziali sono risolte
 *   dall'SDK: token statico (BLOB_READ_WRITE_TOKEN) oppure OIDC
 *   (BLOB_STORE_ID + token fornito dalla runtime Vercel).
 * - Sviluppo locale: file salvati in public/uploads/ e serviti da Next.
 *
 * API: uploadFile(path, data, contentType) → URL pubblico
 *      deleteFileByUrl(url) / listFiles(prefix)
 */

import fs from "node:fs";
import path from "node:path";

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");
const EXTERNAL_URL_RE = /^https?:\/\//i;

/**
 * Vercel Blob è configurato se c'è un token statico oppure se è collegato
 * uno store (l'SDK recupera da solo il token OIDC dalla runtime).
 */
function hasBlobConfig(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function sanitizePath(p: string): string {
  // niente path traversal: solo [a-z0-9._-] e /
  return p
    .replace(/[^a-zA-Z0-9._\-/]/g, "-")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "");
}

async function toBuffer(data: Buffer | Uint8Array | Blob): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Blob) return Buffer.from(await data.arrayBuffer());
  return Buffer.from(data);
}

/**
 * Carica un file e ritorna l'URL pubblico.
 */
export async function uploadFile(
  pathName: string,
  data: Buffer | Uint8Array | Blob,
  contentType?: string
): Promise<string> {
  const clean = sanitizePath(pathName);
  const buffer = await toBuffer(data);

  if (hasBlobConfig()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(clean, buffer, {
      access: "public",
      contentType,
      allowOverwrite: true,
    });
    return blob.url;
  }

  // Fallback locale: public/uploads/<path>
  const dest = path.join(LOCAL_DIR, clean);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return `/uploads/${clean}`;
}

/**
 * Cancella un file dato il suo URL pubblico.
 * Gesti sia Blob che URL locali; gli URL esterni (es. immagini legacy)
 * vengono ignorati silenziosamente.
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  if (!url || EXTERNAL_URL_RE.test(url)) return;

  if (hasBlobConfig() && url.includes("blob.vercel-storage.com")) {
    try {
      const pathname = new URL(url).pathname.replace(/^\/+/, "");
      const { del } = await import("@vercel/blob");
      await del(pathname);
    } catch (err) {
      console.error("Blob delete fallito:", err);
    }
    return;
  }

  if (url.startsWith("/uploads/")) {
    const rel = url.slice("/uploads/".length);
    const dest = path.join(LOCAL_DIR, sanitizePath(rel));
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch (err) {
      console.error("Local delete fallito:", err);
    }
  }
}

export interface StorageFile {
  name: string;
  url: string;
  size: number;
  created_at: string;
}

/**
 * Elenco dei file sotto un prefisso (es. "music/tracks/").
 */
export async function listFiles(prefix: string): Promise<StorageFile[]> {
  const clean = sanitizePath(prefix).replace(/\/+$/, "");

  if (hasBlobConfig()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: clean + "/" });
    return blobs.map((b) => ({
      name: b.pathname.split("/").pop() || b.pathname,
      url: b.url,
      size: b.size,
      created_at: new Date(b.uploadedAt).toISOString(),
    }));
  }

  const dir = path.join(LOCAL_DIR, clean);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return {
        name: f,
        url: `/uploads/${clean}/${f}`,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      };
    });
}
