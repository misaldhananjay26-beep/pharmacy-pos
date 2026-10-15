"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Search } from "lucide-react";
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGst, formatINR } from "@/lib/utils";

import { ProductForm, type ProductFormValues } from "./product-form";

export type ProductRow = {
  id: string;
  name: string;
  genericName: string | null;
  sku: string;
  barcode: string | null;
  hsnCode: string | null;
  gstRateBp: number;
  unit: string;
  mrpPaise: number;
  sellingPricePaise: number;
  reorderLevel: number;
  stock: number;
};

export function ProductTable({
  rows,
  total,
  page,
  pageSize,
  canEdit,
}: {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  canEdit: boolean;
}) {
  const [state, setState] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      sort: parseAsStringEnum(["name", "stock", "price"]).withDefault("name"),
      dir: parseAsStringEnum(["asc", "desc"]).withDefault("asc"),
    },
    { history: "replace", shallow: false },
  );

  const [search, setSearch] = React.useState(state.q);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);

  // Debounce the search box; URL is the single source of truth for filters.
  React.useEffect(() => {
    if (search === state.q) return;
    const t = setTimeout(() => setState({ q: search || null, page: 1 }), 300);
    return () => clearTimeout(t);
  }, [search, state.q, setState]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(col: "name" | "stock" | "price") {
    if (state.sort === col) setState({ dir: state.dir === "asc" ? "desc" : "asc" });
    else setState({ sort: col, dir: "asc" });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function toFormValues(row: ProductRow): ProductFormValues {
    return {
      id: row.id,
      name: row.name,
      genericName: row.genericName ?? "",
      sku: row.sku,
      barcode: row.barcode ?? "",
      hsnCode: row.hsnCode ?? "",
      gstRateBp: row.gstRateBp,
      unit: row.unit,
      mrp: row.mrpPaise / 100,
      sellingPrice: row.sellingPricePaise / 100,
      reorderLevel: row.reorderLevel,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU, or barcode…"
            className="pl-8"
            aria-label="Search products"
          />
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        )}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Product" col="name" state={state} onSort={toggleSort} />
              <TableHead>SKU / Barcode</TableHead>
              <TableHead>GST</TableHead>
              <TableHead className="text-right">
                <SortHead label="MRP" col="price" state={state} onSort={toggleSort} align="right" />
              </TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <TableHead className="text-right">
                <SortHead label="Stock" col="stock" state={state} onSort={toggleSort} align="right" />
              </TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    {row.genericName && (
                      <div className="text-xs text-muted-foreground">{row.genericName}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono">{row.sku}</div>
                    {row.barcode && <div className="font-mono text-muted-foreground">{row.barcode}</div>}
                  </TableCell>
                  <TableCell>{formatGst(row.gstRateBp)}</TableCell>
                  <TableCell className="text-right">{formatINR(row.mrpPaise)}</TableCell>
                  <TableCell className="text-right font-medium">{formatINR(row.sellingPricePaise)}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={row.stock === 0 ? "destructive" : row.stock <= row.reorderLevel ? "warning" : "success"}
                    >
                      {row.stock}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Row actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(row);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} product{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setState({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setState({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing ? toFormValues(editing) : undefined}
      />
    </div>
  );
}

function SortHead({
  label,
  col,
  state,
  onSort,
  align = "left",
}: {
  label: string;
  col: "name" | "stock" | "price";
  state: { sort: string; dir: string };
  onSort: (col: "name" | "stock" | "price") => void;
  align?: "left" | "right";
}) {
  const active = state.sort === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""} hover:text-foreground`}
    >
      {label}
      {active ? (
        state.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}
