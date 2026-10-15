"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withUser } from "@/db";
import { batches, products, purchaseItems, purchases, stockMovements } from "@/db/schema";
import { guardErrorToMessage, requireRole } from "@/lib/auth/guard";
import { rupeesToPaise } from "@/lib/utils";
import { purchaseInput } from "@/lib/validations";

import { fail, ok, type ActionResult } from "./types";

/**
 * Record a purchase from a supplier.
 * WHO: admin, pharmacist.
 * ACID: header + items + stock increment + movement ledger, all in one transaction.
 * STOCK: the increment is atomic (`quantity = quantity + n`) and the batch is created
 *        or refreshed on the (product_id, batch_number) unique key — no read-then-write.
 */
export async function createPurchase(raw: unknown): Promise<ActionResult<{ purchaseId: string }>> {
  try {
    const user = await requireRole(["admin", "pharmacist"]);
    const parsed = purchaseInput.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid purchase.");
    const input = parsed.data;

    const purchaseId = await withUser(user, async (tx) => {
      const [header] = await tx
        .insert(purchases)
        .values({
          supplierId: input.supplierId || null,
          invoiceNumber: input.invoiceNumber || null,
          createdBy: user.id,
        })
        .returning({ id: purchases.id });

      let subtotal = 0;
      let taxTotal = 0;

      for (const item of input.items) {
        const costPaise = rupeesToPaise(item.costPrice);
        const gross = costPaise * item.quantity;
        const lineTax = Math.round((gross * item.gstRateBp) / 10_000);
        subtotal += gross;
        taxTotal += lineTax;

        // Upsert the batch. ON CONFLICT increments quantity atomically.
        const [batch] = await tx
          .insert(batches)
          .values({
            productId: item.productId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            costPricePaise: costPaise,
          })
          .onConflictDoUpdate({
            target: [batches.productId, batches.batchNumber],
            set: {
              quantity: sql`${batches.quantity} + ${item.quantity}`,
              costPricePaise: costPaise,
              expiryDate: item.expiryDate,
              updatedAt: new Date(),
            },
          })
          .returning({ id: batches.id });

        await tx.insert(purchaseItems).values({
          purchaseId: header!.id,
          productId: item.productId,
          batchId: batch!.id,
          quantity: item.quantity,
          costPricePaise: costPaise,
          gstRateBp: item.gstRateBp,
          lineTotalPaise: gross + lineTax,
        });

        await tx.insert(stockMovements).values({
          batchId: batch!.id,
          type: "purchase",
          quantityDelta: item.quantity,
          referenceId: header!.id,
          actorId: user.id,
        });
      }

      await tx
        .update(purchases)
        .set({ subtotalPaise: subtotal, taxPaise: taxTotal, totalPaise: subtotal + taxTotal })
        .where(eq(purchases.id, header!.id));

      return header!.id;
    });

    revalidatePath("/purchases");
    revalidatePath("/inventory");
    return ok({ purchaseId });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}

/**
 * Correct a batch's quantity (stock take / damage / expiry write-off).
 * WHO: admin, pharmacist. Every adjustment is logged in stock_movements.
 */
export async function adjustBatchStock(
  raw: unknown,
): Promise<ActionResult<{ batchId: string }>> {
  try {
    const user = await requireRole(["admin", "pharmacist"]);
    const { adjustStockSchema } = await import("@/lib/validations");
    const parsed = adjustStockSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid adjustment.");
    const { batchId, newQuantity } = parsed.data;

    await withUser(user, async (tx) => {
      // Read current quantity, then set the absolute value + ledger the delta.
      const [current] = await tx
        .select({ quantity: batches.quantity })
        .from(batches)
        .where(eq(batches.id, batchId));
      if (!current) throw new Error("NOT_FOUND");

      const delta = newQuantity - current.quantity;
      await tx
        .update(batches)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(batches.id, batchId));

      if (delta !== 0) {
        await tx.insert(stockMovements).values({
          batchId,
          type: "adjustment",
          quantityDelta: delta,
          actorId: user.id,
        });
      }
    });

    revalidatePath("/inventory");
    return ok({ batchId });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}

export async function listSuppliers() {
  const user = await requireRole(["admin", "pharmacist"]);
  return withUser(user, async (tx) =>
    tx.query.suppliers.findMany({ orderBy: (s, { asc }) => [asc(s.name)] }),
  );
}

export async function listProductsForPurchase() {
  const user = await requireRole(["admin", "pharmacist"]);
  return withUser(user, async (tx) =>
    tx.select({ id: products.id, name: products.name, gstRateBp: products.gstRateBp }).from(products).where(eq(products.isActive, true)),
  );
}
