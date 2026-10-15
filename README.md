# Pharmacy POS

A point-of-sale, inventory, and accounting system for a pharmacy, built on the 2026 stack
with a security-first, AI-guarded codebase.

Regulated medicine stock, money, and health data are involved, so the design assumes a
cashier, a pharmacist, and an admin are all acting at the same time — and that some of them
are hostile.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Database | PostgreSQL 17 on Supabase |
| ORM | Drizzle ORM (drizzle-kit) |
| Auth | Supabase Auth (`@supabase/ssr`, httpOnly cookies) |
| Authorization | Postgres RLS + server-side RBAC guard |
| UI | Tailwind CSS v4 + shadcn-style Radix primitives + lucide-react |
| Data / cache | TanStack Query v5 |
| URL state | nuqs |
| Charts | Recharts |
| Validation | Zod (one schema shared by form and Server Action) |

## Security model (read this first)

1. **RLS is the boundary.** Every table has RLS enabled with explicit policies for every verb.
   A cashier physically cannot read expenses, purchases, or another cashier's sales.
2. **Server Actions guard before they act.** Each action calls `requireRole(...)`. This is
   defence in depth — RLS still filters even if a guard is forgotten.
3. **Atomic, guarded stock.** Checkout decrements stock with
   `UPDATE batches SET quantity = quantity - n WHERE id = ? AND quantity >= n` and asserts
   exactly one row changed. Two people selling the last unit: one wins, the other is rejected.
4. **Money is integer paise; GST is basis points.** No floats anywhere.
5. **Cost price is column-protected.** A cashier gets `permission denied` on
   `batches.cost_price_paise`; privileged reads go through `batch_cost_price()`.
6. **Invoices are immutable.** `sales` / `sale_items` have no UPDATE or DELETE policies.
7. **Everything is audited.** A `SECURITY DEFINER` trigger writes INSERT/UPDATE/DELETE rows
   into an append-only `audit_logs` table that no app role can write.

Architecture decisions live in [`docs/adr/`](docs/adr/). The full rule set is in
[`AGENTS.md`](AGENTS.md), and the security checklist is in
[`security/CHECKLIST.md`](security/CHECKLIST.md).

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL      — project URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon/publishable key
#   SUPABASE_SERVICE_ROLE_KEY     — dashboard → Project Settings → API (server-only)
#   DATABASE_URL                  — dashboard → Project Settings → Database (for drizzle-kit + seed)

# 3. Run migrations (they are applied in the hosted project already; run locally if you self-host)
#    supabase/migrations/0001_schema.sql, 0002_rls_audit.sql, 0003_harden_functions.sql

# 4. Seed demo users, products, and batches
npm run db:seed
#   admin@pharmacy.local / pharmacist@pharmacy.local / cashier@pharmacy.local
#   default password: Pharmacy#12345  (change it after first login)

# 5. Develop
npm run dev            # http://localhost:3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next) |
| `npm run test` | Vitest unit tests |
| `npm run verify` | typecheck + lint + test |
| `npm run db:generate` | Drizzle diff → `./drizzle` |
| `npm run db:push` | Push schema (needs `DATABASE_URL`) |
| `npm run db:seed` | Seed script |
| `npm run security:scan` | Guardrail scanner → `security/reports/` |

## Roles

| Role | Can do |
| --- | --- |
| **admin** | Everything: users, expenses, accounting/P&L, audit log, all inventory and POS |
| **pharmacist** | Inventory, purchases, batch adjustments, POS; **no** expenses or P&L |
| **cashier** | POS only, and sees only their own sales; **no** cost price, expenses, or purchases |

## Project layout

```
src/
  app/                 routes, layouts, Server Components
  components/ui/       shadcn-style primitives
  db/                  Drizzle client (db, withUser), schema, seed
  lib/                 auth guards, Zod schemas, utils, pricing
  server/actions/      "use server" mutation entry points
  server/queries/      read-only aggregations
supabase/migrations/   human-reviewed SQL (schema, RLS, audit, hardening)
docs/adr/              architecture decision records
security/              checklist, plans, and generated scan reports
PRPs/                  product requirement prompts (context-engineering)
```

## License

Private. Not for redistribution.
