import { describe, expect, it } from "vitest";

import { can, HOME_FOR_ROLE } from "@/lib/auth/roles";

describe("permission matrix", () => {
  it("lets every role use the POS", () => {
    expect(can("admin", "pos")).toBe(true);
    expect(can("pharmacist", "pos")).toBe(true);
    expect(can("cashier", "pos")).toBe(true);
  });

  it("keeps cashiers out of accounting, expenses, and cost price", () => {
    expect(can("cashier", "accounting")).toBe(false);
    expect(can("cashier", "expenses")).toBe(false);
    expect(can("cashier", "view_cost_price")).toBe(false);
    expect(can("cashier", "users")).toBe(false);
  });

  it("lets pharmacists manage inventory but not money ledgers", () => {
    expect(can("pharmacist", "inventory")).toBe(true);
    expect(can("pharmacist", "purchases")).toBe(true);
    expect(can("pharmacist", "view_cost_price")).toBe(true);
    expect(can("pharmacist", "accounting")).toBe(false);
    expect(can("pharmacist", "expenses")).toBe(false);
  });

  it("returns false for an undefined role (failure case)", () => {
    expect(can(undefined, "pos")).toBe(false);
  });

  it("routes each role to a sensible landing page", () => {
    expect(HOME_FOR_ROLE.cashier).toBe("/pos");
    expect(HOME_FOR_ROLE.admin).toBe("/dashboard");
  });
});
