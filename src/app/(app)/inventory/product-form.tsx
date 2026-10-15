"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProduct, updateProduct } from "@/server/actions/products";

export type ProductFormValues = {
  id?: string;
  name: string;
  genericName: string;
  sku: string;
  barcode: string;
  hsnCode: string;
  gstRateBp: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  reorderLevel: number;
};

const EMPTY: ProductFormValues = {
  name: "",
  genericName: "",
  sku: "",
  barcode: "",
  hsnCode: "",
  gstRateBp: 1200,
  unit: "strip",
  mrp: 0,
  sellingPrice: 0,
  reorderLevel: 10,
};

export function ProductForm({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductFormValues;
}) {
  const [pending, setPending] = React.useState(false);
  const isEdit = Boolean(initial?.id);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      genericName: String(fd.get("genericName") ?? ""),
      sku: String(fd.get("sku") ?? ""),
      barcode: String(fd.get("barcode") ?? ""),
      hsnCode: String(fd.get("hsnCode") ?? ""),
      gstRateBp: Number(fd.get("gstRateBp") ?? 1200),
      unit: String(fd.get("unit") ?? "strip"),
      mrp: Number(fd.get("mrp") ?? 0),
      sellingPrice: Number(fd.get("sellingPrice") ?? 0),
      reorderLevel: Number(fd.get("reorderLevel") ?? 0),
    };

    try {
      const res =
        isEdit && initial?.id
          ? await updateProduct(initial.id, payload)
          : await createProduct(payload);

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Product updated." : "Product created.");
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  // SECURITY: no client-side field is trusted; the action re-validates with Zod.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Prices are entered in rupees. Stock is added later via a purchase or a stock adjustment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" key={initial?.id ?? "new"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" defaultValue={initial?.name} required />
            <Field label="Generic name" name="genericName" defaultValue={initial?.genericName} />
            <Field label="SKU" name="sku" defaultValue={initial?.sku} required />
            <Field label="Barcode" name="barcode" defaultValue={initial?.barcode} />
            <Field label="HSN code" name="hsnCode" defaultValue={initial?.hsnCode} />
            <div className="space-y-2">
              <Label htmlFor="gstRateBp">GST rate</Label>
              <Select name="gstRateBp" defaultValue={String(initial?.gstRateBp ?? 1200)}>
                <SelectTrigger id="gstRateBp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="500">5%</SelectItem>
                  <SelectItem value="1200">12%</SelectItem>
                  <SelectItem value="1800">18%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Unit" name="unit" defaultValue={initial?.unit ?? "strip"} required />
            <Field
              label="MRP (₹)"
              name="mrp"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.mrp ?? 0}
              required
            />
            <Field
              label="Selling price (₹)"
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.sellingPrice ?? 0}
              required
            />
            <Field
              label="Reorder level"
              name="reorderLevel"
              type="number"
              min="0"
              defaultValue={initial?.reorderLevel ?? 10}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  defaultValue,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} {...rest} />
    </div>
  );
}

export { EMPTY as EMPTY_PRODUCT };
