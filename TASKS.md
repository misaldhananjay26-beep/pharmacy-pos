# TASKS

> Update this file the moment a task changes state. Add anything you find but do not fix
> to **Discovered During Work**.

## Phase 1 — Foundation ✅
- [x] Repo skeleton, `package.json`, TypeScript strict config
- [x] Context/guardrail layer: `AGENTS.md`, `.cursorrules`, `CLAUDE.md`, `INITIAL.md`, `PRPs/`
- [x] Next.js security headers + CSP (`next.config.ts`)
- [x] Tailwind v4 (CSS-first) + hand-rolled shadcn-style primitives
- [x] Supabase Auth via `@supabase/ssr` (httpOnly cookies), middleware gate
- [x] Shared role model + `requireRole` / `requirePageRole` boundary

## Phase 2 — Database + security ✅
- [x] Drizzle schema mirroring the SQL baseline (`src/db/schema.ts`)
- [x] Baseline DDL `supabase/migrations/0001_schema.sql`
- [x] RLS + audit + role plumbing `0002_rls_audit.sql`
- [x] Function hardening `0003_harden_functions.sql`
- [x] Migrations applied to the live project
- [x] Advisors clean (only the intentional authenticated helpers remain)
- [x] Proven: cashier sees 0 expenses, cannot insert an expense, cannot read `cost_price`

## Phase 3 — Inventory CRUD ✅
- [x] Product create/update/deactivate with Zod validation
- [x] Batch-aware, FEFO stock reads; stock is the sum of unexpired batches
- [x] Purchases: atomic batch upsert (`quantity = quantity + n`)
- [x] Guarded stock adjustment with `stock_movements` ledger

## Phase 4 — POS ✅
- [x] FEFO batch lookup by barcode / SKU / name
- [x] Cart with server-recomputed prices and GST (client numbers are display-only)
- [x] Atomic, race-safe checkout (`UPDATE … WHERE quantity >= qty`)
- [x] Immutable invoice (`sale_items` snapshot; no UPDATE/DELETE policies on sales)

## Phase 5 — Accounting ✅
- [x] Expense capture (admin only, RLS-enforced)
- [x] P&L aggregation from sales / purchases / expenses
- [x] Recharts P&L view
- [x] Audit trail viewer (admin only)

## Phase 6 — Verification & tooling ✅
- [x] Unit tests for pricing (`src/lib/pricing.test.ts`) and RBAC (`src/server/services/rbac.test.ts`) — 12/12 green
- [x] `scripts/security-scan.mjs` guardrail scanner — 0 errors, 0 warnings
- [x] Seed script `src/db/seed.ts` + `supabase/seed.sql` (privileged connection, no server-only issues)
- [x] **CVE-2025-66478** (CVSS 10.0 RSC RCE) fixed: `next` pinned to `15.5.28`
- [x] `docs/adr/` architecture decision records (ADR-0001–0004)
- [x] `security/reports/`, `security/plans/`, `AUDIT_SUMMARY.md`
- [x] `npm run typecheck && npm run lint && npm run test` green
- [x] `npm run build` passes (production build verified)
- [x] Live demo data seeded (users with roles, supplier, products, batches)
- [x] RLS invariants verified (cashier cannot read expenses/cost price; cannot insert expenses); audit trigger operational; atomic stock checks in code
- [x] `npm run dev` ready; app build-validated and security posture confirmed

## Discovered During Work
- Supabase MCP exposes no tool to read the `service_role` key, and the DB password is not
  returned at project creation. Both must be copied from the dashboard into `.env.local`
  before `npm run db:seed` / `drizzle-kit push` will work. The app itself runs on the
  anon key + RLS, so it is unaffected.
- `set_config('role','authenticated', true)` plus `request.jwt.claims` is the mechanism
  that makes RLS apply to a Drizzle `postgres.js` connection (see ADR-0003).
- Postgres column privileges cannot be revoked while a table-level `SELECT` grant exists,
  so `batches` uses explicit column grants (ADR-0004).
