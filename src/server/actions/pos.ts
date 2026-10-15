"use server";

import { and, asc, eq, gt, ilike, inArray, or } from "drizzle-orm";

import { withUser } from "@/db";
import { batches, products } from "@/db/schema";
import { requireRole } from "@/lib/auth/guard";

export type PosBatch = {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
};

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  gstRateBp: number;
  unitPricePaise: number;
  unit: string;
  batches: PosBatch[];
};

/**
 * POS product lookup by barcode / SKU / name.
 * WHO: any signed-in role.
 * FEFO: batches are returned earliest-expiry-first, and only unexpired batches with stock.
 */
export async function searchSellableProducts(query: string): Promise<PosProduct[]> {
  const user = await requireRole(["admin", "pharmacist", "cashier"]);
  const q = query.trim();
  if (q.length < 1) return [];

  return withUser(user, async (tx) => {
    const today = new Date().toISOString().slice(0, 10);

    const found = await tx
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        gstRateBp: products.gstRateBp,
        unitPricePaise: products.sellingPricePaise,
        unit: products.unit,
      })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          or(ilike(products.barcode, q), ilike(products.sku, q), ilike(products.name, `%${q}%`)),
        ),
      )
      .orderBy(asc(products.name))
      .limit(20);

    if (found.length === 0) return [];

    const ids = found.map((p) => p.id);
    const batchRows = await tx
      .select({
        batchId: batches.id,
        productId: batches.productId,
        batchNumber: batches.batchNumber,
        expiryDate: batches.expiryDate,
        quantity: batches.quantity,
      })
      .from(batches)
      .where(and(inArray(batches.productId, ids), gt(batches.quantity, 0)))
      .orderBy(asc(batches.expiryDate));

    // Hide expired batches explicitly (belt-and-braces on top of the query).
    const byProduct = new Map<string, PosBatch[]>();
    for (const b of batchRows) {
      if (b.expiryDate < today) continue;
      const list = byProduct.get(b.productId) ?? [];
      list.push({
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
      });
      byProduct.set(b.productId, list);
    }

    return found.map((p) => ({ ...p, batches: byProduct.get(p.id) ?? [] }));
  });
}
