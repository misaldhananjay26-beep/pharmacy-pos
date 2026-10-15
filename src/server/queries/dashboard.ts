import { and, asc, count, desc, eq, gt, gte, lte, sql } from "drizzle-orm";

import { withUser } from "@/db";
import { batches, products, sales } from "@/db/schema";
import { requireRole } from "@/lib/auth/guard";

export async function getDashboardStats() {
  // Pharmacists need stock/expiry; only admins see money. Guard accordingly.
  const user = await requireRole(["admin", "pharmacist"]);
  const showMoney = user.role === "admin";

  return withUser(user, async (tx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [productCount] = await tx
      .select({ n: count() })
      .from(products)
      .where(eq(products.isActive, true));

    const lowStock = await tx
      .select({
        productId: products.id,
        name: products.name,
        stock: sql<number>`coalesce(sum(${batches.quantity}), 0)::int`,
        reorderLevel: products.reorderLevel,
      })
      .from(products)
      .leftJoin(batches, eq(batches.productId, products.id))
      .where(eq(products.isActive, true))
      .groupBy(products.id)
      .having(sql`coalesce(sum(${batches.quantity}), 0) <= ${products.reorderLevel}`)
      .orderBy(asc(sql`coalesce(sum(${batches.quantity}), 0)`))
      .limit(10);

    const soon = new Date();
    soon.setDate(soon.getDate() + 90);
    const expiring = await tx
      .select({
        batchId: batches.id,
        batchNumber: batches.batchNumber,
        expiryDate: batches.expiryDate,
        quantity: batches.quantity,
        productName: products.name,
      })
      .from(batches)
      .innerJoin(products, eq(products.id, batches.productId))
      .where(
        and(gt(batches.quantity, 0), lte(batches.expiryDate, soon.toISOString().slice(0, 10))),
      )
      .orderBy(asc(batches.expiryDate))
      .limit(10);

    const [todaySales] = await tx
      .select({
        orders: count(),
        revenuePaise: sql<number>`coalesce(sum(${sales.totalPaise}), 0)::int`,
      })
      .from(sales)
      .where(gte(sales.createdAt, today));

    return {
      productCount: productCount?.n ?? 0,
      lowStock,
      expiring,
      todayOrders: todaySales?.orders ?? 0,
      todayRevenuePaise: showMoney ? (todaySales?.revenuePaise ?? 0) : null,
    };
  });
}

export async function getRecentSales(limit = 8) {
  const user = await requireRole(["admin", "pharmacist"]);
  return withUser(user, async (tx) =>
    tx
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        totalPaise: sales.totalPaise,
        paymentMode: sales.paymentMode,
        createdAt: sales.createdAt,
        customerName: sales.customerName,
      })
      .from(sales)
      .orderBy(desc(sales.createdAt))
      .limit(limit),
  );
}
