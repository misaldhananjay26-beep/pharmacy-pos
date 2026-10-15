"use server";

import { and, desc, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withUser } from "@/db";
import { expenses } from "@/db/schema";
import { guardErrorToMessage, requireRole } from "@/lib/auth/guard";
import { rupeesToPaise } from "@/lib/utils";
import { expenseSchema } from "@/lib/validations";

import { fail, ok, type ActionResult } from "./types";

/** WHO: admin only. Cashiers and pharmacists must never see or write expenses. */
export async function createExpense(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(["admin"]);
    const parsed = expenseSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
    const e = parsed.data;

    const [row] = await withUser(user, async (tx) =>
      tx
        .insert(expenses)
        .values({
          category: e.category,
          description: e.description,
          amountPaise: rupeesToPaise(e.amount),
          expenseDate: e.expenseDate,
          createdBy: user.id,
        })
        .returning({ id: expenses.id }),
    );

    revalidatePath("/expenses");
    revalidatePath("/accounting");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}

export async function listExpenses(range?: { from?: string; to?: string }) {
  const user = await requireRole(["admin"]);
  return withUser(user, async (tx) => {
    const conditions = [];
    if (range?.from) conditions.push(gte(expenses.expenseDate, range.from));
    if (range?.to) conditions.push(lte(expenses.expenseDate, range.to));
    return tx
      .select({
        id: expenses.id,
        category: expenses.category,
        description: expenses.description,
        amountPaise: expenses.amountPaise,
        expenseDate: expenses.expenseDate,
        createdBy: expenses.createdBy,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(expenses.expenseDate))
      .limit(500);
  });
}

/** Aggregated expense total for the P&L view. */
export async function expenseTotal(range: { from: string; to: string }) {
  const user = await requireRole(["admin"]);
  return withUser(user, async (tx) => {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${expenses.amountPaise}), 0)::int` })
      .from(expenses)
      .where(and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)));
    return row?.total ?? 0;
  });
}
