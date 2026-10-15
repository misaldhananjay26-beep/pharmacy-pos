/**
 * Shared, client-safe role + permission model.
 * IMPORTANT: this file is a convenience for the UI (hiding nav, disabling buttons).
 * It is NOT the security boundary. The real checks are `requireRole()` on the server
 * and the Postgres RLS policies. Never rely on `can()` alone.
 */
export const ROLES = ["admin", "pharmacist", "cashier"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  pos: ["admin", "pharmacist", "cashier"],
  sales_view_all: ["admin", "pharmacist"],
  inventory: ["admin", "pharmacist"],
  purchases: ["admin", "pharmacist"],
  expenses: ["admin"],
  accounting: ["admin"],
  users: ["admin"],
  audit: ["admin"],
  view_cost_price: ["admin", "pharmacist"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
};

/** Where each role lands after login. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/dashboard",
  pharmacist: "/inventory",
  cashier: "/pos",
};
