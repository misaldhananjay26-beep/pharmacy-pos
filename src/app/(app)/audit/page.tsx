import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs, listStockMovements } from "@/server/queries/audit";

const ACTION_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "destructive",
};

export default async function AuditPage() {
  await requirePageRole(["admin"]);
  const [logs, movements] = await Promise.all([listAuditLogs(100), listStockMovements(100)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only. Written by a database trigger — the application cannot edit or delete it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Row changes</CardTitle>
          <CardDescription>Every change to inventory, sales, and pricing tables.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{l.tableName}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANT[l.action] ?? "secondary"}>{l.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.actorId ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.recordId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock movements</CardTitle>
          <CardDescription>Immutable ledger of purchases, sales, adjustments and write-offs.</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead>Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell className="capitalize">{m.type}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${m.quantityDelta < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {m.quantityDelta > 0 ? "+" : ""}
                      {m.quantityDelta}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.batchId}</TableCell>
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
