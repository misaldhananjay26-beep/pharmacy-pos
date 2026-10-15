import { and, gte, lte, sql } from "drizzle-orm";

import { withUser } from "@/db";
import { expenses, purchases, sales } from "@/db/schema";
import { requireRole } from "@/lib/auth/guard";

export type PnlRow = {
  day: string;
  revenuePaise: number;
  costPaise: number;
  expensePaise: number;
};

export type PnlSummary = {
  revenuePaise: number;
  taxPaise: number;
  purchaseCostPaise: number;
  expensePaise: number;
  grossProfitPaise: number;
  netProfitPaise: number;
  orderCount: number;
};

/**
 * Profit & Loss. WHO: admin only.
 * Revenue comes from `sales`; cost of goods from `purchases`; overheads from `expenses`.
 * This is intentionally a read-only aggregation — nothing here mutates state.
 */
export async function getProfitAndLoss(range: { from: string; to: string }) {
  const user = await requireRole(["admin"]);

  return withUser(user, async (tx) => {
    const [salesAgg] = await tx
      .select({
        revenuePaise: sql<number>`coalesce(sum(${sales.totalPaise}), 0)::int`,
        taxPaise: sql<number>`coalesce(sum(${sales.taxPaise}), 0)::int`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.createdAt, new Date(`${range.from}T00:00:00+05:30`)),
          lte(sales.createdAt, new Date(`${range.to}T23:59:59+05:30`)),
        ),
      );

    const [purchaseAgg] = await tx
      .select({ costPaise: sql<number>`coalesce(sum(${purchases.totalPaise}), 0)::int` })
      .from(purchases)
      .where(
        and(
          gte(purchases.createdAt, new Date(`${range.from}T00:00:00+05:30`)),
          lte(purchases.createdAt, new Date(`${range.to}T23:59:59+05:30`)),
        ),
      );

    const [expenseAgg] = await tx
      .select({ expensePaise: sql<number>`coalesce(sum(${expenses.amountPaise}), 0)::int` })
      .from(expenses)
      .where(and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)));

    const daily = await tx
      .select({
        day: sql<string>`to_char(${sales.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        revenuePaise: sql<number>`coalesce(sum(${sales.totalPaise}), 0)::int`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.createdAt, new Date(`${range.from}T00:00:00+05:30`)),
          lte(sales.createdAt, new Date(`${range.to}T23:59:59+05:30`)),
        ),
      )
      .groupBy(sql`to_char(${sales.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`1`);

    const revenuePaise = salesAgg?.revenuePaise ?? 0;
    const taxPaise = salesAgg?.taxPaise ?? 0;
    const purchaseCostPaise = purchaseAgg?.costPaise ?? 0;
    const expensePaise = expenseAgg?.expensePaise ?? 0;

    const summary: PnlSummary = {
      revenuePaise,
      taxPaise,
      purchaseCostPaise,
      expensePaise,
      grossProfitPaise: revenuePaise - taxPaise - purchaseCostPaise,
      netProfitPaise: revenuePaise - taxPaise - purchaseCostPaise - expensePaise,
      orderCount: salesAgg?.orderCount ?? 0,
    };

    const series: PnlRow[] = daily.map((d) => ({
      day: d.day,
      revenuePaise: d.revenuePaise,
      costPaise: 0,
      expensePaise: 0,
    }));

    return { summary, series };
  });
}
