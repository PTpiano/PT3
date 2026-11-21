import { useEffect, useState } from "react";
import { ASSETS } from "@/assets";

/* ---------- IndexedDB blob store (uploads from the admin panel) ---------- */
const DB = "nocturne-media";
const ST = "files";
/** Store parallelo: nome originale del file (per il caricamento al server). */
const NM = "names";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(ST)) db.createObjectStore(ST);
      if (!db.objectStoreNames.contains(NM)) db.createObjectStore(NM);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

/** Salva un file nel browser. `name` è il nome originale (per il server). */
export async function putFile(blob: Blob, name?: string): Promise<string> {
  const db = await open();
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await new Promise<void>((res, rej) => {
    const tx = db.transaction([ST, NM], "readwrite");
    tx.objectStore(ST).put(blob, id);
    if (name) tx.objectStore(NM).put(name, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return `idb:${id}`;
}

export async function getFile(ref: string): Promise<Blob | undefined> {
  const id = ref.replace(/^idb:/, "");
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(ST).objectStore(ST).get(id);
    r.onsuccess = () => res(r.result as Blob | undefined);
    r.onerror = () => rej(r.error);
  });
}

/** Nome originale del file salvato nel browser (se noto). */
export async function getFileName(ref: string): Promise<string | undefined> {
  const id = ref.replace(/^idb:/, "");
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(NM, "readonly").objectStore(NM).get(id);
    r.onsuccess = () => res(r.result as string | undefined);
    r.onerror = () => rej(r.error);
  });
}

export async function clearFiles() {
  const db = await open();
  await new Promise<void>((res) => {
    const tx = db.transaction([ST, NM], "readwrite");
    tx.objectStore(ST).clear();
    tx.objectStore(NM).clear();
    tx.oncomplete = () => res();
  });
}

const urlCache = new Map<string, string>();

export async function resolveAsync(ref?: string): Promise<string> {
  if (!ref) return "";
  if (ref.startsWith("asset:")) return ASSETS[ref.slice(6)] ?? "";
  if (!ref.startsWith("idb:")) return ref;
  const hit = urlCache.get(ref);
  if (hit) return hit;
  const blob = await getFile(ref);
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}

export function resolveSync(ref?: string): string {
  if (!ref) return "";
  if (ref.startsWith("asset:")) return ASSETS[ref.slice(6)] ?? "";
  if (ref.startsWith("idb:")) return urlCache.get(ref) ?? "";
  return ref;
}

/** React hook: turns `asset:`/`idb:`/url references into a usable src */
export function useSrc(ref?: string): string {
  const [src, setSrc] = useState(() => resolveSync(ref));
  useEffect(() => {
    let live = true;
    const s = resolveSync(ref);
    if (s || !ref) {
      setSrc(s);
      return;
    }
    resolveAsync(ref).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [ref]);
  return src;
}

/* ---------- helpers ---------- */
export async function compressImage(file: File, maxW = 2000, q = 0.86): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", q));
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

/** Full backup: JSON + every uploaded file embedded as data URL */
export async function exportBackup(data: unknown): Promise<string> {
  const json = JSON.stringify(data);
  const refs = Array.from(new Set(json.match(/idb:[a-z0-9]+/g) || []));
  const media: Record<string, string> = {};
  for (const r of refs) {
    const b = await getFile(r);
    if (b) media[r] = await toDataUrl(b);
  }
  return JSON.stringify({ v: 1, data, media });
}

/** Public snapshot for visitors: uploaded media inlined, private data stripped */
export async function exportPublish(data: Record<string, unknown> & { settings: Record<string, unknown> }): Promise<string> {
  const clean = { ...data, orders: [], messages: [], settings: { ...data.settings, adminPassword: undefined } };
  let json = JSON.stringify(clean);
  const refs = Array.from(new Set(json.match(/idb:[a-z0-9]+/g) || []));
  for (const r of refs) {
    const b = await getFile(r);
    json = json.split(r).join(b ? await toDataUrl(b) : "");
  }
  return json;
}

export async function importBackup(text: string): Promise<unknown> {
  const parsed = JSON.parse(text);
  const data = parsed.data ?? parsed;
  let json = JSON.stringify(data);
  const media: Record<string, string> = parsed.media || {};
  for (const [oldRef, dataUrl] of Object.entries(media)) {
    const blob = await (await fetch(dataUrl)).blob();
    const newRef = await putFile(blob);
    json = json.split(oldRef).join(newRef);
  }
  return JSON.parse(json);
}
