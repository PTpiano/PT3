/**
 * Configurazione shop di un album — contratto condiviso fra il sito Next,
 * la SPA "new design" e il database.
 *
 * Un album ha due descrizioni parallele:
 *  · le colonne `price_*` / `stock_*` (storiche, usate da /api/checkout);
 *  · `shop_config`, un JSON completo che descrive i formati offerti:
 *    quali sono attivi, prezzo, offerta libera, stock e — per i formati
 *    digitali — il file che il cliente scarica.
 *
 * `shop_config` ha la precedenza: se presente, il sito mostra esattamente i
 * formati descritti lì (e ignora le colonne storiche). Se assente vale il
 * comportamento di sempre (un formato esiste se ha prezzo o stock).
 *
 * I `kind` sono gli stessi del sito Next: digital | hires | vinyl | cd | tape.
 */

export type ShopFormatKind = "digital" | "hires" | "vinyl" | "cd" | "tape";

export interface ShopFormat {
  /** Identificativo stabile dentro l'album (non obbligatorio). */
  id?: string;
  kind: ShopFormatKind;
  /** Etichetta mostrata al cliente ("Vinile 180 g — edizione numerata"). */
  label?: string;
  /** Prezzo in euro. Con pwyw è il prezzo suggerito. */
  price: number;
  /** Offerta libera: il cliente sceglie quanto pagare (anche 0). */
  pwyw?: boolean;
  /** Importo minimo con pwyw (0 = può essere gratis). */
  min?: number;
  /** Copie disponibili. null = illimitato. */
  stock?: number | null;
  /** File consegnato al cliente (solo formati digitali). */
  file?: string;
  /** Note brevi mostte sotto al nome del formato. */
  note?: string;
}

export interface ShopConfig {
  formats: ShopFormat[];
  /** Link di pagamento dedicato (Stripe Payment Link / PayPal). */
  paymentLink?: string;
  /** Nota mostrata dopo l'ordine. */
  paymentNote?: string;
}

/** Etichette di default per ogni tipo di formato. */
export const FORMAT_LABEL: Record<ShopFormatKind, string> = {
  digital: "Digitale",
  hires: "Hi-Res",
  vinyl: "Vinile",
  cd: "CD",
  tape: "Cassetta",
};

/** Un formato è digitale (nessuna spedizione fisica). */
export const isDigitalKind = (k: ShopFormatKind): boolean =>
  k === "digital" || k === "hires";

/**
 * Scala lo stock di un formato dentro la configurazione.
 * Gli stock null (illimitati) restano null.
 */
export function decrementFormatStock(
  cfg: ShopConfig,
  kind: ShopFormatKind,
  qty: number
): ShopConfig {
  const n = Number.isFinite(qty) ? Math.max(1, Math.trunc(qty)) : 1;
  return {
    ...cfg,
    formats: cfg.formats.map((f) =>
      f.kind === kind && typeof f.stock === "number"
        ? { ...f, stock: Math.max(0, f.stock - n) }
        : f
    ),
  };
}

/**
 * Normalizza un valore sconosciuto (JSONB dal DB, payload del client) in
 * una ShopConfig valida. Restituisce null se non c'è nulla di utilizzabile.
 */
export function parseShopConfig(raw: unknown): ShopConfig | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;

  const o = obj as Record<string, unknown>;
  const rawFormats = Array.isArray(o.formats) ? o.formats : [];
  const formats: ShopFormat[] = [];

  for (const f of rawFormats) {
    if (!f || typeof f !== "object") continue;
    const fo = f as Record<string, unknown>;
    const kind = fo.kind;
    if (
      kind !== "digital" &&
      kind !== "hires" &&
      kind !== "vinyl" &&
      kind !== "cd" &&
      kind !== "tape"
    )
      continue;
    const price = Number(fo.price);
    formats.push({
      id: typeof fo.id === "string" ? fo.id : undefined,
      kind,
      label: typeof fo.label === "string" ? fo.label : FORMAT_LABEL[kind],
      price: Number.isFinite(price) ? price : 0,
      pwyw: !!fo.pwyw,
      min: Number.isFinite(Number(fo.min)) ? Number(fo.min) : 0,
      stock: fo.stock === null || fo.stock === undefined ? null : Number(fo.stock),
      file: typeof fo.file === "string" ? fo.file : undefined,
      note: typeof fo.note === "string" ? fo.note : undefined,
    });
  }

  if (!formats.length) return null;
  return {
    formats,
    paymentLink: typeof o.paymentLink === "string" ? o.paymentLink : undefined,
    paymentNote: typeof o.paymentNote === "string" ? o.paymentNote : undefined,
  };
}
