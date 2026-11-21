import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "../../../../lib/db";
import { verifyAdminAuth } from "../../../utils/auth";

/**
 * GET /api/admin/orders — solo admin.
 * Restituisce gli ordini con i relativi articoli, più recenti prima.
 * (Prima la pagina admin/store leggeva la tabella orders dal browser
 * con la anon key: su Vercel le letture passano solo dalle API route.)
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await query(
      `SELECT * FROM orders ORDER BY created_at DESC`
    );
    const orderIds = orders.map((o) => (o as { id: string }).id);

    let items: Record<string, unknown>[] = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(", ");
      items = await query(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
        orderIds
      );
    }

    const itemsByOrder = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const orderId = item.order_id as string;
      const list = itemsByOrder.get(orderId) ?? [];
      list.push(item);
      itemsByOrder.set(orderId, list);
    }

    const result = orders.map((order) => ({
      ...order,
      order_items: itemsByOrder.get((order as { id: string }).id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
