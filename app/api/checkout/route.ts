import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "../../../lib/db";
import { isDigitalKind, parseShopConfig, type ShopFormatKind } from "../../../lib/shop";

/**
 * POST /api/checkout
 *
 * Crea la Stripe Checkout Session per il carrello.
 *
 * Regola di sicurezza: il prezzo NON viene mai preso dal client, salvo per
 * l'offerta libera, dove il cliente sceglie l'importo — e in quel caso
 * pavimento (0 €) e tetto (500 €) sono imposti qui dentro, non nel browser.
 *
 * Env richieste (server-only):
 *   STRIPE_SECRET_KEY
 *   DATABASE_URL (PostgreSQL)
 *   NEXT_PUBLIC_SITE_URL  (opzionale: fallback sugli header della richiesta)
 *
 * Stessa coppia `metadata.album_id` / `metadata.format` usata prima: il webhook
 * `app/api/webhooks/stripe/route.ts` continua a funzionare senza modifiche.
 */

const FREE_CONTRIBUTION_CAP = 500; // €, tetto per l'offerta libera

type FormatId = "digital" | "hires" | "vinyl" | "cd" | "tape";

type CartItem = {
  albumId: string;
  formatId: FormatId;
  /** Importo offerto, solo per i formati a offerta libera. */
  offeredAmount?: number;
};

/** Formati a offerta libera: il prezzo lo sceglie chi compra. */
const PAY_WHAT_YOU_WANT: ReadonlySet<FormatId> = new Set<FormatId>(["digital", "hires"]);

/** Formati fisici: hanno stock da verificare lato server. */
const STOCK_COLUMN: Partial<Record<FormatId, string>> = {
  vinyl: "stock_vinyl",
  cd: "stock_cd",
  tape: "stock_tape",
};

/** Mappa formato → colonna prezzo. `format in PRICE_COLUMN` valida l'input. */
const PRICE_COLUMN = {
  digital: "price_digital",
  hires: "price_hires",
  vinyl: "price_vinyl",
  cd: "price_cd",
  tape: "price_tape",
} as const;

const FORMAT_LABEL: Record<FormatId, string> = {
  digital: "Digitale",
  hires: "Hi-Res",
  vinyl: "Vinile",
  cd: "CD",
  tape: "Cassetta",
};

/** Prezzo di riferimento quando l'artista non ha impostato nulla. */
const FALLBACK_PRICE: Partial<Record<FormatId, number>> = {
  digital: 9.99,
  cd: 14.99,
  vinyl: 24.99,
};

/** shop_config usa gli stessi kind del checkout: hires↔hires, tape↔tape. */
const SHOP_KIND: Record<FormatId, ShopFormatKind> = {
  digital: "digital",
  hires: "hires",
  vinyl: "vinyl",
  cd: "cd",
  tape: "tape",
};

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Origin preferito: env, altrimenti l'host della richiesta. */
function resolveOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = req.headers.get("host") ?? "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = req.headers.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

/** Prezzo unitario in centesimi, ricalcolato dal database. */
function resolveUnitAmount(
  row: Record<string, unknown>,
  format: FormatId,
  offeredAmount: number | undefined
): number {
  // Con shop_config il prezzo (e l'offerta libera) vengono dal pannello admin.
  const cfg = parseShopConfig(row.shop_config);
  const cfgFormat = cfg?.formats.find((f) => f.kind === SHOP_KIND[format]);

  if (cfgFormat) {
    if (cfgFormat.pwyw) {
      const offered = Number.isFinite(offeredAmount) ? Number(offeredAmount) : 0;
      const floor = cfgFormat.min ?? 0;
      const clamped = Math.min(FREE_CONTRIBUTION_CAP, Math.max(floor, offered));
      return Math.round(clamped * 100);
    }
    const rawPrice = Number(cfgFormat.price);
    const base = Number.isFinite(rawPrice) ? rawPrice : 0;
    return Math.round(base * 100);
  }

  if (PAY_WHAT_YOU_WANT.has(format)) {
    const offered = Number.isFinite(offeredAmount) ? Number(offeredAmount) : 0;
    // 0 € è una donazione valida, non un errore.
    return Math.round(Math.min(FREE_CONTRIBUTION_CAP, Math.max(0, offered)) * 100);
  }

  const raw = row[PRICE_COLUMN[format]];
  const parsed = typeof raw === "number" ? raw : Number(raw);
  const price = Number.isFinite(parsed) ? parsed : FALLBACK_PRICE[format];

  // L'offerta applica lo sconto configurato lato admin, non lato browser.
  let base = price;
  if (row.is_on_offer === true) {
    const off = Number(row.discount_percent);
    if (Number.isFinite(off) && off > 0) base -= (base * off) / 100;
  }
  return Math.round(base * 100);
}

/**
 * Verifica che il formato richiesto sia effettivamente in vendita.
 * Con shop_config la lista dei formati attivi è quella: un formato non
 * presente non può essere ordinato, nemmeno manipolando la richiesta.
 */
function checkFormatAvailable(row: Record<string, unknown>, format: FormatId): string | null {
  const cfg = parseShopConfig(row.shop_config);
  if (!cfg) return null;
  const found = cfg.formats.find((f) => f.kind === SHOP_KIND[format]);
  if (!found) return `${row.title} — ${FORMAT_LABEL[format]} non è disponibile`;
  if (found.stock !== null && found.stock !== undefined && found.stock <= 0) {
    return `${row.title} (${FORMAT_LABEL[format]}) è esaurito`;
  }
  return null;
}

/** Verifica stock dei formati fisici. Returns null quando OK. */
function checkStock(row: Record<string, unknown>, format: FormatId): string | null {
  const column = STOCK_COLUMN[format];
  if (!column) return null;

  const stock = row[column];
  if (stock === null || stock === undefined) return null; // stock non gestito
  if (typeof stock === "number" && stock <= 0) {
    return `${row.title} (${FORMAT_LABEL[format]}) è esaurito`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) return fail(503, "Pagamenti non configurati");

  let items: CartItem[];
  let customerEmail: string | undefined;
  let notes: string | undefined;

  try {
    const body = await req.json();
    items = Array.isArray(body?.items) ? body.items : [];
    customerEmail = typeof body?.email === "string" && body.email.includes("@") ? body.email : undefined;
    notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : undefined;
  } catch {
    return fail(400, "Richiesta non valida");
  }

  if (items.length === 0) return fail(400, "Carrello vuoto");
  if (items.length > 50) return fail(400, "Carrello troppo grande");

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const origin = resolveOrigin(req);

  // Un album per richiesta, prezzo ricalcolato: nulla del carrello è fidato.
  const albumIds = [...new Set(items.map((i) => i.albumId).filter(Boolean))];
  if (albumIds.length === 0) return fail(400, "Articolo non valido");
  let albums: Record<string, unknown>[];
  try {
    const placeholders = albumIds.map((_, i) => `$${i + 1}`).join(", ");
    albums = await query(
      `SELECT * FROM albums WHERE id IN (${placeholders})`,
      albumIds
    );
  } catch {
    return fail(500, "Catalogo non raggiungibile");
  }

  const byId = new Map(
    (albums ?? []).map((a) => [String((a as { id: string | number }).id), a as Record<string, unknown>])
  );

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of items) {
    const albumId = String(item.albumId ?? "");
    const format = item.formatId;

    if (!albumId || !(format in PRICE_COLUMN)) return fail(400, "Articolo non valido");

    const album = byId.get(albumId);
    if (!album) return fail(400, "Album non trovato");
    if (album.published === false) return fail(400, "Album non disponibile");

    const unavailable = checkFormatAvailable(album, format);
    if (unavailable) return fail(409, unavailable);

    // Con shop_config lo stock è quello del config: le colonne storiche
    // non devono contraddirlo (potrebbero valere 0 per un formato illimitato).
    if (!parseShopConfig(album.shop_config)) {
      const outOfStock = checkStock(album, format);
      if (outOfStock) return fail(409, outOfStock);
    }

    const unitAmount = resolveUnitAmount(album, format, item.offeredAmount);

    // Stripe rifiuta sotto 0,50 €: per l'offerta libera vale solo se il
    // cliente ha offerto qualcosa di sopra lo zero.
    if (unitAmount > 0 && unitAmount < 50) return fail(400, "Importo non valido");

    const coverUrl = typeof album.cover_url === "string" ? album.cover_url : "";
    const image = coverUrl ? (coverUrl.startsWith("http") ? coverUrl : `${origin}${coverUrl}`) : "";
    const description = [
      typeof album.artist === "string" ? album.artist : null,
      typeof album.year === "number" ? String(album.year) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: `${album.title} — ${FORMAT_LABEL[format]}`,
          ...(description ? { description } : {}),
          images: image ? [image] : [],
          metadata: { album_id: albumId, format },
        },
        unit_amount: unitAmount,
      },
      quantity: 1,
    });
  }

  const successUrl = new URL("/negozio", origin);
  successUrl.searchParams.set("success", "1");
  const cancelUrl = new URL("/negozio", origin);
  cancelUrl.searchParams.set("canceled", "1");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    ...(notes ? { metadata: { notes } } : {}),
    shipping_address_collection: {
      allowed_countries: ["IT", "US", "GB", "FR", "DE", "ES", "CH", "AT"],
    },
    payment_intent_data: {
      metadata: { album_ids: albumIds.join(","), source: "nocturne-shop" },
    },
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
  });

  return NextResponse.json({ id: session.id, url: session.url });
}