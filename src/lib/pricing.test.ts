import { describe, expect, it } from "vitest";

import { computeLineTotals, computeSaleTotals, mergeCartQuantities } from "./pricing";

describe("computeLineTotals", () => {
  it("adds GST on top of the gross (happy path)", () => {
    const t = computeLineTotals({ unitPricePaise: 1200, quantity: 10, gstRateBp: 1200 });
    expect(t.grossPaise).toBe(12000);
    expect(t.taxPaise).toBe(1440);
    expect(t.lineTotalPaise).toBe(13440);
  });

  it("handles a zero-rated line (edge case)", () => {
    const t = computeLineTotals({ unitPricePaise: 500, quantity: 1, gstRateBp: 0 });
    expect(t.taxPaise).toBe(0);
    expect(t.lineTotalPaise).toBe(500);
  });

  it("rejects a zero quantity (failure case)", () => {
    expect(() => computeLineTotals({ unitPricePaise: 100, quantity: 0, gstRateBp: 500 })).toThrow(
      /Quantity/,
    );
  });
});

describe("computeSaleTotals", () => {
  it("sums per-line tax then applies discount (happy path)", () => {
    const totals = computeSaleTotals(
      [
        { unitPricePaise: 1000, quantity: 2, gstRateBp: 500 },
        { unitPricePaise: 2500, quantity: 1, gstRateBp: 1200 },
      ],
      500,
    );
    expect(totals.subtotalPaise).toBe(4500);
    expect(totals.taxPaise).toBe(400);
    expect(totals.totalPaise).toBe(4400);
  });

  it("rejects a discount larger than the bill (failure case)", () => {
    expect(() =>
      computeSaleTotals([{ unitPricePaise: 100, quantity: 1, gstRateBp: 0 }], 1000),
    ).toThrow(/Discount/);
  });

  it("rejects an empty cart (edge case)", () => {
    expect(() => computeSaleTotals([])).toThrow(/empty/i);
  });
});

describe("mergeCartQuantities", () => {
  it("merges duplicate batches so stock is decremented once", () => {
    const merged = mergeCartQuantities([
      { batchId: "a", quantity: 2 },
      { batchId: "a", quantity: 3 },
      { batchId: "b", quantity: 1 },
    ]);
    expect(merged.get("a")).toBe(5);
    expect(merged.get("b")).toBe(1);
  });
});
