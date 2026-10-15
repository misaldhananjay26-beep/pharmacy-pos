"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPurchase } from "@/server/actions/purchases";

type ProductOpt = { id: string; name: string; gstRateBp: number };
type Line = {
  key: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  gstRateBp: number;
};

const newLine = (products: ProductOpt[]): Line => ({
  key: crypto.randomUUID(),
  productId: products[0]?.id ?? "",
  batchNumber: "",
  expiryDate: "",
  quantity: 1,
  costPrice: 0,
  gstRateBp: products[0]?.gstRateBp ?? 1200,
});

export function PurchaseForm({
  products,
  suppliers,
}: {
  products: ProductOpt[];
  suppliers: { id: string; name: string }[];
}) {
  const [lines, setLines] = React.useState<Line[]>(() => [newLine(products)]);
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [pending, setPending] = React.useState(false);

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await createPurchase({
        supplierId: supplierId || "",
        invoiceNumber,
        items: lines.map((l) => ({
          productId: l.productId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          quantity: l.quantity,
          costPrice: l.costPrice,
          gstRateBp: l.gstRateBp,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Purchase recorded and stock updated.");
      setLines([newLine(products)]);
      setInvoiceNumber("");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
          <CardDescription>Supplier and invoice are optional but recommended.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Supplier invoice #</Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>Expiry is per batch. Cost is what you paid per unit.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine(products)])}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Product</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-28">Cost (₹)</TableHead>
                <TableHead className="w-24">GST</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.key}>
                  <TableCell>
                    <Select
                      value={l.productId}
                      onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        update(l.key, { productId: v, gstRateBp: p?.gstRateBp ?? l.gstRateBp });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={l.batchNumber}
                      onChange={(e) => update(l.key, { batchNumber: e.target.value })}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={l.expiryDate}
                      onChange={(e) => update(l.key, { expiryDate: e.target.value })}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: Number(e.target.value) || 1 })}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.costPrice}
                      onChange={(e) => update(l.key, { costPrice: Number(e.target.value) || 0 })}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(l.gstRateBp)}
                      onValueChange={(v) => update(l.key, { gstRateBp: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="500">5%</SelectItem>
                        <SelectItem value="1200">12%</SelectItem>
                        <SelectItem value="1800">18%</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={lines.length === 1}
                      onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record purchase"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
