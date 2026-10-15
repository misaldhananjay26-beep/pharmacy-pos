"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setUserActive, setUserRole } from "@/server/actions/users";

type Row = { id: string; email: string; fullName: string; role: string; isActive: boolean };

export function UsersTable({ rows, currentUserId }: { rows: Row[]; currentUserId: string }) {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function changeRole(id: string, role: string) {
    setBusy(id);
    try {
      const res = await setUserRole(id, role);
      if (!res.ok) toast.error(res.error);
      else toast.success("Role updated.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(id);
    try {
      const res = await setUserActive(id, isActive);
      if (!res.ok) toast.error(res.error);
      else toast.success(isActive ? "User activated." : "User deactivated.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isSelf = r.id === currentUserId;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <Select
                    value={r.role}
                    disabled={busy === r.id}
                    onValueChange={(v) => changeRole(r.id, v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {r.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === r.id || isSelf}
                    onClick={() => toggleActive(r.id, !r.isActive)}
                  >
                    {r.isActive ? "Disable" : "Enable"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
