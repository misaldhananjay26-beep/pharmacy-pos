import { requirePageRole } from "@/lib/auth/guard";
import { getProfitAndLoss } from "@/server/queries/accounting";
import { formatINR } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PnlChart } from "./pnl-chart";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePageRole(["admin"]);
  const sp = await searchParams;
  const fallback = defaultRange();
  const range = {
    from: /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : fallback.from,
    to: /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : fallback.to,
  };

  const { summary, series } = await getProfitAndLoss(range);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
        <p className="text-sm text-muted-foreground">
          Profit &amp; loss for {range.from} → {range.to}. Admin-only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Revenue (incl. GST)" value={formatINR(summary.revenuePaise)} />
        <Stat title="Purchase cost" value={formatINR(summary.purchaseCostPaise)} />
        <Stat title="Expenses" value={formatINR(summary.expensePaise)} />
        <Stat
          title="Net profit"
          value={formatINR(summary.netProfitPaise)}
          tone={summary.netProfitPaise >= 0 ? "pos" : "neg"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <PnlChart data={series} />
          )}
        </CardContent>
      </Card>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">From</span>
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="block rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">To</span>
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            className="block rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Apply
        </button>
      </form>

      <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
        <div>Orders: {summary.orderCount}</div>
        <div>GST collected: {formatINR(summary.taxPaise)}</div>
        <div>Gross profit: {formatINR(summary.grossProfitPaise)}</div>
      </div>
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={
            tone === "neg" ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
