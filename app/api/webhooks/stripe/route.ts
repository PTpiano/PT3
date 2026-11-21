import { NextResponse } from "next/server";
import Stripe from "stripe";
import { query, queryOne } from "../../../../lib/db";
import {
  decrementFormatStock,
  isDigitalKind,
  parseShopConfig,
  type ShopFormatKind,
} from "../../../../lib/shop";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    // Allineata a node_modules/stripe/types/apiVersion.d.ts
    apiVersion: "2025-12-15.clover",
  });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!webhookSecret) {
    console.error("Webhook secret missing");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Retrieve full session with line_items and product metadata
    const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product"],
    });

    const customerEmail = session.customer_details?.email;
    const amountTotal = session.amount_total;
    const shippingAddress =
      (session as any).shipping_details?.address ??
      session.customer_details?.address;

    // Idempotenza: se l'ordine esiste già (riprove del webhook) non reinserire.
    const existingOrder = await queryOne<{ id: string }>(
      `SELECT id FROM orders WHERE stripe_session_id = $1`,
      [session.id]
    );

    if (!existingOrder) {
      // Insert order
      let order: { id: string } | undefined;
      try {
        const rows = await query<{ id: string }>(
          `INSERT INTO orders (stripe_session_id, customer_email, shipping_address, total_amount, status)
           VALUES ($1, $2, $3::jsonb, $4, 'paid') RETURNING id`,
          [
            session.id,
            customerEmail || null,
            shippingAddress ? JSON.stringify(shippingAddress) : null,
            amountTotal ?? 0,
          ]
        );
        order = rows[0];
      } catch (orderError) {
        console.error("Error inserting order:", orderError);
        return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
      }

      // Insert order items from line_items
      const lineItems = expandedSession.line_items?.data || [];

      if (lineItems.length > 0 && order) {
        const orderItems = lineItems
          .map((item) => {
            const product = item.price?.product as any;
            const metadata = product?.metadata || {};
            const albumId = metadata.album_id || null;
            const format = metadata.format || null;
            return {
              order_id: order!.id,
              album_id: albumId,
              format,
              quantity: item.quantity ?? 1,
              price: item.price?.unit_amount ?? 0,
            };
          });

        try {
          for (const item of orderItems) {
            await query(
              `INSERT INTO order_items (order_id, album_id, format, quantity, price)
               VALUES ($1, $2, $3, $4, $5)`,
              [item.order_id, item.album_id, item.format, item.quantity, item.price]
            );
          }
        } catch (itemsError) {
          console.error("Error inserting order items:", itemsError);
          return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
        }

        // Decrement stock for physical formats
        for (const item of orderItems) {
          const format = item.format as ShopFormatKind | null;
          if (!format || isDigitalKind(format)) continue;
          if (format !== "cd" && format !== "vinyl" && format !== "tape") continue;
          try {
            // Se l'album usa shop_config, lo stock sta dentro il JSON:
            // va scalato lì, non sulle colonne storiche.
            const album = await queryOne<{ shop_config?: unknown }>(
              `SELECT shop_config FROM albums WHERE id = $1`,
              [item.album_id]
            );
            const cfg = parseShopConfig(album?.shop_config);
            if (cfg) {
              const next = decrementFormatStock(cfg, format, item.quantity);
              await query(`UPDATE albums SET shop_config = $1 WHERE id = $2`, [
                JSON.stringify(next),
                item.album_id,
              ]);
              continue;
            }

            const stockColumn =
              format === "cd" ? "stock_cd" : format === "vinyl" ? "stock_vinyl" : "stock_tape";
            await query(
              `UPDATE albums SET ${stockColumn} = GREATEST(0, COALESCE(${stockColumn}, 0) - $1)
               WHERE id = $2`,
              [item.quantity, item.album_id]
            );
          } catch (stockError) {
            console.error(`Error decrementing stock for album ${item.album_id}:`, stockError);
          }
        }
      }
    }

    console.log("Checkout completed and order saved:", {
      sessionId: session.id,
      customerEmail,
      amountTotal,
      items: expandedSession.line_items?.data.map((item) => ({
        name: item.description,
        quantity: item.quantity,
        amount: item.amount_total,
      })),
    });
  }

  return NextResponse.json({ received: true });
}
