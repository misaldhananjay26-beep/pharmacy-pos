"use server";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withUser } from "@/db";
import { batches, products, saleItems, sales, stockMovements } from "@/db/schema";
import { guardErrorToMessage, requireRole } from "@/lib/auth/guard";
import { saleInput } from "@/lib/validations";
import { computeLineTotals, mergeCartQuantities } from "@/lib/pricing";

import { fail, ok, type ActionResult } from "./types";

type SaleResult = { saleId: string; invoiceNumber: string; totalPaise: number };

/**
 * POS checkout.
 *
 * WHO:   admin, pharmacist, cashier.
 * INPUT: batch ids + quantities ONLY. Prices, GST, and totals are recomputed here from
 *        the database — the client's numbers are display-only and are discarded.
 * ACID:  the whole thing runs in one transaction. If any batch lacks stock, we throw and
 *        the sale is rolled back; inventory is never left half-deducted.
 * RACE:  stock is decremented with a guarded atomic UPDATE ... WHERE quantity >= qty.
 *        Two simultaneous sales of the last unit: one updates 1 row, the other 0 rows
 *        and is rejected.
 */
export async function createSale(raw: unknown): Promise<ActionResult<SaleResult>> {
  try {
    const user = await requireRole(["admin", "pharmacist", "cashier"]);

    const parsed = saleInput.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid sale.");
    }
    const input = parsed.data;

    // Collapse duplicate batch lines so a batch is never decremented by two statements.
    const merged = mergeCartQuantities(input.items);
    const batchIds = [...merged.keys()];
    const productByBatch = new Map(input.items.map((i) => [i.batchId, i.productId]));

    const result = await withUser(user, async (tx) => {
      // 1. Trust the database for price + GST. Join guarantees the batch exists.
      const dbRows = await tx
        .select({
          batchId: batches.id,
          productId: batches.productId,
          name: products.name,
          unitPricePaise: products.sellingPricePaise,
          gstRateBp: products.gstRateBp,
          isActive: products.isActive,
        })
        .from(batches)
        .innerJoin(products, eq(products.id, batches.productId))
        .where(inArray(batches.id, batchIds));

      const byId = new Map(dbRows.map((r) => [r.batchId, r]));

      type Line = {
        batchId: string;
        productId: string;
        name: string;
        quantity: number;
        unitPricePaise: number;
        gstRateBp: number;
        taxPaise: number;
        lineTotalPaise: number;
      };

      const lines: Line[] = [];
      for (const [batchId, quantity] of merged) {
        const row = byId.get(batchId);
        // Reject unknown batches, inactive products, and mismatched product/batch pairs.
        if (!row || !row.isActive || productByBatch.get(batchId) !== row.productId) {
          throw new Error("INVALID_ITEM");
        }
        const t = computeLineTotals({
          unitPricePaise: row.unitPricePaise,
          quantity,
          gstRateBp: row.gstRateBp,
        });
        lines.push({
          batchId,
          productId: row.productId,
          name: row.name,
          quantity,
          unitPricePaise: row.unitPricePaise,
          gstRateBp: row.gstRateBp,
          taxPaise: t.taxPaise,
          lineTotalPaise: t.lineTotalPaise,
        });
      }

      const subtotalPaise = lines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0);
      const taxPaise = lines.reduce((s, l) => s + l.taxPaise, 0);
      const beforeDiscount = subtotalPaise + taxPaise;
      if (input.discountPaise > beforeDiscount) throw new Error("INVALID_DISCOUNT");
      const totalPaise = beforeDiscount - input.discountPaise;

      // 2. Human-readable invoice number from a Postgres sequence.
      const invRows = (await tx.execute(
        sql`select 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('sale_invoice_seq')::text, 5, '0') as inv`,
      )) as unknown as Array<{ inv: string }>;
      const invoiceNumber = invRows[0]!.inv;

      // 3. Header.
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNumber,
          customerName: input.customerName || null,
          customerPhone: input.customerPhone || null,
          subtotalPaise,
          taxPaise,
          discountPaise: input.discountPaise,
          totalPaise,
          paymentMode: input.paymentMode,
          createdBy: user.id,
        })
        .returning({ id: sales.id });

      // 4. Snapshot lines (immutable invoice).
      await tx.insert(saleItems).values(
        lines.map((l) => ({
          saleId: sale!.id,
          productId: l.productId,
          batchId: l.batchId,
          productName: l.name,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise,
          gstRateBp: l.gstRateBp,
          taxPaise: l.taxPaise,
          lineTotalPaise: l.lineTotalPaise,
        })),
      );

      // 5. Atomic, guarded stock decrement. THE race-condition fix.
      for (const l of lines) {
        const updated = await tx
          .update(batches)
          .set({ quantity: sql`${batches.quantity} - ${l.quantity}`, updatedAt: new Date() })
          .where(and(eq(batches.id, l.batchId), gte(batches.quantity, l.quantity)))
          .returning({ id: batches.id, quantity: batches.quantity });

        if (updated.length !== 1) {
          // Throwing rolls back the sale, the items, and any earlier decrements.
          throw new Error(`INSUFFICIENT_STOCK:${l.name}`);
        }

        await tx.insert(stockMovements).values({
          batchId: l.batchId,
          type: "sale",
          quantityDelta: -l.quantity,
          referenceId: sale!.id,
          actorId: user.id,
        });
      }

      return { saleId: sale!.id, invoiceNumber, totalPaise };
    });

    revalidatePath("/pos");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return ok(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("INSUFFICIENT_STOCK:")) {
      return fail(`Not enough stock for ${msg.split(":")[1] ?? "an item"}. Sale not completed.`);
    }
    if (msg === "INVALID_ITEM") return fail("One of the items is no longer available.");
    if (msg === "INVALID_DISCOUNT") return fail("Discount is larger than the bill.");
    return fail(guardErrorToMessage(err));
  }
}
