import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/guard";
import { formatINR } from "@/lib/utils";
import { listExpenses } from "@/server/actions/expenses";

import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage() {
  await requirePageRole(["admin"]);
  const rows = await listExpenses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          Overheads that reduce net profit. Visible to administrators only.
        </p>
      </div>

      <ExpenseForm />

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.expenseDate}</TableCell>
                    <TableCell className="capitalize">{r.category}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-right">{formatINR(r.amountPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
