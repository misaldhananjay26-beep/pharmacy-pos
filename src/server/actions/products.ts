"use server";

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withUser } from "@/db";
import { batches, products } from "@/db/schema";
import { guardErrorToMessage, requireRole } from "@/lib/auth/guard";
import { rupeesToPaise } from "@/lib/utils";
import { productSchema } from "@/lib/validations";

import { fail, ok, type ActionResult } from "./types";

/** List products with aggregated stock. Cashiers may call this (POS needs it). */
export async function listProducts(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "stock" | "price";
  dir?: "asc" | "desc";
}) {
  const user = await requireRole(["admin", "pharmacist", "cashier"]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const search = params.search?.trim() ?? "";

  return withUser(user, async (tx) => {
    const where = search
      ? and(
          eq(products.isActive, true),
          or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`), ilike(products.barcode, `%${search}%`)),
        )
      : eq(products.isActive, true);

    const stockExpr = sql<number>`coalesce(sum(${batches.quantity}), 0)::int`;

    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        genericName: products.genericName,
        sku: products.sku,
        barcode: products.barcode,
        hsnCode: products.hsnCode,
        gstRateBp: products.gstRateBp,
        unit: products.unit,
        mrpPaise: products.mrpPaise,
        sellingPricePaise: products.sellingPricePaise,
        reorderLevel: products.reorderLevel,
        stock: stockExpr,
      })
      .from(products)
      // LEFT JOIN so a product with no batches still appears (stock 0).
      .leftJoin(batches, eq(batches.productId, products.id))
      .where(where)
      .groupBy(products.id)
      .orderBy(params.sort === "stock" ? (params.dir === "desc" ? desc(stockExpr) : asc(stockExpr)) : params.sort === "price" ? (params.dir === "desc" ? desc(products.sellingPricePaise) : asc(products.sellingPricePaise)) : params.dir === "desc" ? desc(products.name) : asc(products.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalRows = await tx
      .select({ total: count() })
      .from(products)
      .where(where);

    return { rows, total: totalRows[0]?.total ?? 0, page, pageSize };
  });
}

export async function createProduct(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(["admin", "pharmacist"]);
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid product.");
    const p = parsed.data;

    const created = await withUser(user, async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({
          name: p.name,
          genericName: p.genericName || null,
          sku: p.sku,
          barcode: p.barcode || null,
          hsnCode: p.hsnCode || null,
          gstRateBp: p.gstRateBp,
          unit: p.unit,
          mrpPaise: rupeesToPaise(p.mrp),
          sellingPricePaise: rupeesToPaise(p.sellingPrice),
          reorderLevel: p.reorderLevel,
        })
        .returning({ id: products.id });
      return row;
    });

    revalidatePath("/inventory");
    return ok({ id: created!.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes("products_sku_uq")) {
      return fail("That SKU already exists.");
    }
    if (err instanceof Error && err.message.includes("products_barcode")) {
      return fail("That barcode is already assigned.");
    }
    return fail(guardErrorToMessage(err));
  }
}

export async function updateProduct(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(["admin", "pharmacist"]);
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid product.");
    const p = parsed.data;

    await withUser(user, async (tx) => {
      await tx
        .update(products)
        .set({
          name: p.name,
          genericName: p.genericName || null,
          sku: p.sku,
          barcode: p.barcode || null,
          hsnCode: p.hsnCode || null,
          gstRateBp: p.gstRateBp,
          unit: p.unit,
          mrpPaise: rupeesToPaise(p.mrp),
          sellingPricePaise: rupeesToPaise(p.sellingPrice),
          reorderLevel: p.reorderLevel,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
    });

    revalidatePath("/inventory");
    return ok({ id });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}

export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(["admin", "pharmacist"]);
    await withUser(user, async (tx) => {
      await tx.update(products).set({ isActive, updatedAt: new Date() }).where(eq(products.id, id));
    });
    revalidatePath("/inventory");
    return ok({ id });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}
