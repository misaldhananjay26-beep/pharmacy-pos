import Link from "next/link";
import { AlertTriangle, CalendarClock, IndianRupee, Package, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/guard";
import { formatDateTime, formatINR } from "@/lib/utils";
import { getDashboardStats, getRecentSales } from "@/server/queries/dashboard";

export default async function DashboardPage() {
  await requirePageRole(["admin", "pharmacist"]);
  const [stats, recent] = await Promise.all([getDashboardStats(), getRecentSales()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance, and what needs attention.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Orders today" value={String(stats.todayOrders)} icon={ShoppingCart} />
        {stats.todayRevenuePaise !== null && (
          <StatCard title="Revenue today" value={formatINR(stats.todayRevenuePaise)} icon={IndianRupee} />
        )}
        <StatCard title="Active products" value={String(stats.productCount)} icon={Package} />
        <StatCard title="Expiring ≤ 90 days" value={String(stats.expiring.length)} icon={CalendarClock} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low stock
            </CardTitle>
            <CardDescription>At or below the reorder level.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything is above its reorder level.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.lowStock.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="warning">{p.stock}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.reorderLevel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Expiring soon
            </CardTitle>
            <CardDescription>Batches with stock expiring within 90 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">No near-expiry batches.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.expiring.map((b) => (
                    <TableRow key={b.batchId}>
                      <TableCell className="font-medium">{b.productName}</TableCell>
                      <TableCell>{b.batchNumber}</TableCell>
                      <TableCell>{b.expiryDate}</TableCell>
                      <TableCell className="text-right">{b.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
          <CardDescription>
            Last few invoices your team raised.{" "}
            <Link href="/pos" className="underline">
              Open POS
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.invoiceNumber}</TableCell>
                    <TableCell>{s.customerName ?? "Walk-in"}</TableCell>
                    <TableCell className="capitalize">{s.paymentMode}</TableCell>
                    <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(s.totalPaise)}</TableCell>
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

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
