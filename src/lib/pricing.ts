/**
 * Pure money + GST math. No database, no framework — fully unit-testable and safe to
 * import from both Server Actions and Client Components.
 *
 * CONVENTIONS
 *  - All amounts are integer paise.
 *  - `gstRateBp` is basis points: 500 = 5%, 1200 = 12%.
 *  - Catalogue prices are GST-EXCLUSIVE; tax is added on top, per line, then summed.
 *    (Rounding at the grand total instead of per line produces a wrong tax invoice.)
 *  - NEVER duplicate this logic in a component or in SQL. Import it.
 */

export type CartLine = {
  unitPricePaise: number;
  quantity: number;
  gstRateBp: number;
};

export type LineTotals = {
  grossPaise: number; // pre-tax
  taxPaise: number;
  lineTotalPaise: number; // gross + tax
};

export function computeLineTotals(line: CartLine): LineTotals {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }
  if (line.unitPricePaise < 0 || line.gstRateBp < 0) {
    throw new Error("Price and GST rate must be non-negative");
  }
  const grossPaise = line.unitPricePaise * line.quantity;
  const taxPaise = Math.round((grossPaise * line.gstRateBp) / 10_000);
  return { grossPaise, taxPaise, lineTotalPaise: grossPaise + taxPaise };
}

export type SaleTotals = {
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
};

export function computeSaleTotals(lines: CartLine[], discountPaise = 0): SaleTotals {
  if (lines.length === 0) throw new Error("Cart is empty");
  if (!Number.isInteger(discountPaise) || discountPaise < 0) {
    throw new Error("Discount must be a non-negative integer");
  }

  let subtotalPaise = 0;
  let taxPaise = 0;
  for (const line of lines) {
    const t = computeLineTotals(line);
    subtotalPaise += t.grossPaise;
    taxPaise += t.taxPaise;
  }

  const beforeDiscount = subtotalPaise + taxPaise;
  if (discountPaise > beforeDiscount) {
    throw new Error("Discount cannot exceed the bill total");
  }

  return {
    subtotalPaise,
    taxPaise,
    discountPaise,
    totalPaise: beforeDiscount - discountPaise,
  };
}

/** Group cart lines so the same batch is never decremented in two statements. */
export function mergeCartQuantities(
  items: { batchId: string; quantity: number }[],
): Map<string, number> {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.batchId, (merged.get(item.batchId) ?? 0) + item.quantity);
  }
  return merged;
}
