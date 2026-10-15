# INITIAL.md — Feature Specification

> Follows the `context-engineering-intro` convention. This file is the human's spec for the current
> body of work. The agent turns it into a PRP (`PRPs/*.md`) before writing code.

## FEATURE

Build **Pharmacy POS** — a multi-user web application for a retail pharmacy that manages regulated
medicine inventory, point-of-sale billing with GST, purchasing, and profit-and-loss accounting.

Concretely, the application must support:

1. **Authentication & RBAC** with three roles:
   - `admin` — full access incl. user management, expenses, profit & loss, audit log.
   - `pharmacist` — inventory CRUD, purchasing, stock adjustments, can view sales; cannot see expenses or P&L.
   - `cashier` — POS sales only; can view the products they can sell; cannot see cost price, purchases, expenses, or P&L.
2. **Inventory** — products with a barcode/SKU, batch number, expiry date, HSN code, GST rate, cost price,
   selling price, and current stock. Products dashboard is a shadcn data table with sorting, filtering, search
   (URL-persisted via nuqs) and pagination.
3. **Purchase entry** — record a purchase from a supplier: multiple line items, updates stock and cost inside one transaction.
4. **POS** — keyboard-first screen. Scan/type a barcode, add to cart, adjust quantity, choose payment mode,
   compute GST per line and grand total, and submit. Submission writes the sale and decrements inventory
   **atomically**, refusing to oversell.
5. **Accounting** — a Profit & Loss dashboard aggregating sales, purchases, and expenses over a date range,
   rendered with Recharts. Admin-only.
6. **Audit log** — an immutable, append-only record of every change to inventory and sales, written by a
   Postgres trigger (not by application code).
7. **Expiry alerts** — products expiring within 90 days or low on stock are surfaced on the dashboard.

Non-goals for v1: online storefront, multi-branch, loyalty program, insurance claims, e-prescriptions.

## EXAMPLES

Reference implementations to mirror (adapt, don't copy blindly):

- `src/server/actions/sales.ts` — the canonical transactional Server Action pattern
  (Zod validate → `requireRole` → `db.transaction` → guarded atomic stock update → audit).
- `src/server/services/pricing.ts` — pure, unit-tested money/GST math. Never duplicate this logic in a component.
- `src/lib/auth/index.ts` — how session + role are resolved server-side.
- `supabase/migrations/*_rls.sql` — how RLS policies and the audit trigger are written.
- `PRPs/templates/prp_base.md` — the structure every task spec must follow.

When in doubt about a pattern, prefer the example here over inventing a new one.

## DOCUMENTATION

- Next.js App Router — https://nextjs.org/docs/app
- React Server Components — https://react.dev/reference/rsc/server-components
- Drizzle ORM — https://orm.drizzle.team/docs/overview
- Drizzle transactions — https://orm.drizzle.team/docs/transactions
- Supabase Auth with Next.js (`@supabase/ssr`) — https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security
- Postgres trigger functions (PL/pgSQL) — https://www.postgresql.org/docs/current/plpgsql-trigger.html
- shadcn/ui — https://ui.shadcn.com/docs
- shadcn Data Table — https://ui.shadcn.com/docs/components/data-table
- TanStack Query v5 — https://tanstack.com/query/latest/docs/framework/react/overview
- nuqs — https://nuqs.47ng.com/
- Zod — https://zod.dev/
- Recharts — https://recharts.org/
- GST on medicines (India) — HSN 3004, rates 5% / 12% as applicable.

## OTHER CONSIDERATIONS — gotchas the AI reliably misses here

1. **Expiry is per-batch, not per-product.** Two batches of the same medicine have different expiries. Model
   `batches`, and sell from the earliest-expiring batch first (FEFO). Do not put `expiry` on `products`.
2. **`stock` is derived, not stored twice.** The authoritative quantity lives on `batches.quantity`; a product's
   available stock is the sum. Cache it in a view if you need speed, never hand-sync two columns.
3. **GST must be computed per line, then summed.** Rounding at the grand total gives the wrong invoice. Tax
   inclusive vs exclusive pricing matters — make it explicit in the schema.
4. **Never trust the client total.** The POS sends `{ productId, batchId, quantity }`; the server prices it.
5. **Race conditions are real** in a pharmacy with two counters. All stock math is guarded atomic updates
   inside a transaction. Test it by running two sales concurrently.
6. **Supabase RLS is the backstop, the Server Action guard is the primary control.** Both must exist. RLS
   protects against a leaked anon token; the action guard gives good errors.
7. **`.env` is gitignored.** Ship `.env.example` only. The service-role key must never appear in a client import.
8. **Never store secrets, tokens, or cart PII in `localStorage`.** Session lives in httpOnly cookies.
9. **Timestamps are `timestamptz`, always UTC in the DB.** Format to `Asia/Kolkata` only at render.
10. **Migrations are additive and reviewed by a human.** Schema mistakes cascade into every feature — the human
    reviews every migration before it is applied.
