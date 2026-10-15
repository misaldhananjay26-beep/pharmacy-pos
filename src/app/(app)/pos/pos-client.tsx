"use client";

import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeSaleTotals, type CartLine } from "@/lib/pricing";
import { formatINR } from "@/lib/utils";
import { searchSellableProducts, type PosProduct } from "@/server/actions/pos";
import { createSale } from "@/server/actions/sales";

type CartItem = CartLine & {
  key: string;
  productId: string;
  batchId: string;
  name: string;
  batchNumber: string;
  available: number;
};

export function PosClient() {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PosProduct[]>([]);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = React.useState<"cash" | "card" | "upi">("cash");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [discount, setDiscount] = React.useState(0);
  const [pending, setPending] = React.useState(false);

  async function runSearch(raw: string) {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const found = await searchSellableProducts(q);
    setResults(found);
    // Keyboard-first: an exact barcode/SKU hit with a single stock batch goes straight to the cart.
    const exact = found.find((p) => p.barcode === q || p.sku === q);
    if (exact && exact.batches.length > 0) addToCart(exact);
  }

  function addToCart(product: PosProduct) {
    const batch = product.batches[0]; // FEFO: earliest expiry first
    if (!batch || batch.quantity <= 0) {
      toast.error("No stock available for this product.");
      return;
    }
    const key = batch.batchId;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        if (existing.quantity >= batch.quantity) {
          toast.error(`Only ${batch.quantity} in stock for this batch.`);
          return prev;
        }
        return prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          batchId: batch.batchId,
          name: product.name,
          batchNumber: batch.batchNumber,
          available: batch.quantity,
          unitPricePaise: product.unitPricePaise,
          gstRateBp: product.gstRateBp,
          quantity: 1,
        },
      ];
    });
    setQuery("");
    setResults([]);
    searchRef.current?.focus();
  }

  function setQty(key: string, qty: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: Math.min(Math.max(0, qty), c.available) } : c))
        .filter((c) => c.quantity > 0),
    );
  }

  const totals = React.useMemo(() => {
    try {
      return computeSaleTotals(
        cart.map((c) => ({ unitPricePaise: c.unitPricePaise, quantity: c.quantity, gstRateBp: c.gstRateBp })),
        Math.round(discount * 100),
      );
    } catch {
      return { subtotalPaise: 0, taxPaise: 0, discountPaise: 0, totalPaise: 0 };
    }
  }, [cart, discount]);

  async function checkout() {
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }
    setPending(true);
    try {
      // SECURITY: we send identifiers + quantities only. The server prices the bill.
      const res = await createSale({
        items: cart.map((c) => ({ productId: c.productId, batchId: c.batchId, quantity: c.quantity })),
        paymentMode,
        customerName,
        customerPhone,
        discountPaise: Math.round(discount * 100),
      });
      if (!res.ok) {
        toast.error(res.error);
        // A rejected sale may mean stock changed underneath us — refresh results.
        return;
      }
      toast.success(`Sale complete · ${res.data.invoiceNumber} · ${formatINR(res.data.totalPaise)}`);
      setCart([]);
      setDiscount(0);
      setCustomerName("");
      setCustomerPhone("");
      searchRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-4 w-4" />
            Scan or search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (results.length === 1 && results[0]) addToCart(results[0]);
              else void runSearch(query);
            }}
          >
            <Input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Barcode / SKU / name, then Enter"
              aria-label="Product search"
            />
          </form>

          <div className="space-y-2">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                disabled={p.batches.length === 0}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku}
                    {p.batches[0] ? ` · batch ${p.batches[0].batchNumber} · exp ${p.batches[0].expiryDate}` : " · no stock"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatINR(p.unitPricePaise)}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.batches.reduce((s, b) => s + b.quantity, 0)} in stock
                  </div>
                </div>
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Press Enter to search.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Cart</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-28 text-center">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    Empty cart.
                  </TableCell>
                </TableRow>
              ) : (
                cart.map((c) => {
                  const line = computeSaleTotals([c]);
                  return (
                    <TableRow key={c.key}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          batch {c.batchNumber} · max {c.available}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setQty(c.key, c.quantity - 1)}
                            aria-label={`Decrease ${c.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{c.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setQty(c.key, c.quantity + 1)}
                            aria-label={`Increase ${c.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatINR(line.totalPaise)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setQty(c.key, 0)}
                          aria-label={`Remove ${c.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="mt-auto space-y-4 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer (optional)</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone (optional)</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentMode">Payment</Label>
                <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as typeof paymentMode)}>
                  <SelectTrigger id="paymentMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount (₹)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatINR(totals.subtotalPaise)} />
              <Row label="GST" value={formatINR(totals.taxPaise)} />
              {totals.discountPaise > 0 && (
                <Row label="Discount" value={`− ${formatINR(totals.discountPaise)}`} />
              )}
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatINR(totals.totalPaise)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Displayed total is indicative. The server recomputes it at checkout.
              </p>
            </div>

            <Button className="w-full" size="lg" onClick={checkout} disabled={pending || cart.length === 0}>
              {pending ? "Processing…" : "Complete sale"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
