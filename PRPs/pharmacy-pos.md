---
name: pharmacy-pos
description: Full build spec for the Pharmacy POS, inventory, and accounting system, delivered in 5 phases.
---

# PRP — Pharmacy POS

> Global rules: follow every rule in [`AGENTS.md`](../AGENTS.md) and [`.cursorrules`](../.cursorrules).
> Do NOT implement a phase until the previous phase's Validation Loop passes and the human has reviewed it.

## Goal

Deliver a production-shaped pharmacy application: Supabase-backed Postgres with Drizzle, Supabase Auth
with three roles enforced by Postgres RLS **and** server-side guards, a data-table inventory screen, a
keyboard-first POS that bills atomically, and an admin P&L dashboard. Every stock/money mutation is
transactional, audited by a trigger, and race-safe.

## Why

- A pharmacy cannot oversell a medicine or lose track of a controlled batch.
- Cashiers must never see cost price, expenses, or profit — even if they replay requests by hand.
- Reconciliation (profit & loss) has to be derived from the same immutable sales records the POS wrote.

## What

- [ ] Phase 1 — Foundation: Next.js 15 + React 19 + Tailwind v4 + shadcn + Drizzle + Supabase Auth + RBAC.
- [ ] Phase 2 — Schema: products, batches, suppliers, purchases, sales, expenses, users, audit_logs + RLS + triggers.
- [ ] Phase 3 — Inventory CRUD: shadcn Data Table with sort/filter/search(nuqs)/pagination.
- [ ] Phase 4 — POS: barcode search, cart, GST, atomic checkout.
- [ ] Phase 5 — Accounting: P&L dashboard with Recharts.

### Success Criteria

- [ ] A cashier token hitting `expenses` directly against Postgres returns zero rows.
- [ ] Two concurrent sales of the final unit: exactly one succeeds.
- [ ] A checkout that fails mid-way leaves inventory untouched.
- [ ] `npm run typecheck && npm run lint && npm run test` pass.

## All Needed Context

### Documentation & References

```yaml
- url: https://supabase.com/docs/guides/auth/server-side/nextjs
  why: correct cookie-based session handling with @supabase/ssr in App Router
  critical: use createServerClient with cookies() and getUser(); never getSession() for authz
- url: https://orm.drizzle.team/docs/transactions
  why: db.transaction API shape
  critical: throw inside the callback to roll back; return a value to commit
- url: https://supabase.com/docs/guides/database/postgres/row-level-security
  why: policy syntax and helper functions
  critical: enable RLS on every table; add policies for all four verbs
- url: https://www.postgresql.org/docs/current/plpgsql-trigger.html
  why: audit trigger function
  critical: trigger writes to audit_logs; use SECURITY DEFINER
- file: src/server/actions/sales.ts
  why: canonical transactional action
- file: src/lib/auth/rbac.ts
  why: requireRole guard used by every action
- file: supabase/migrations/0001_rls_audit.sql
  why: RLS + audit trigger reference
```

### Known Gotchas

```ts
// GOTCHA: expiry and quantity live on batches, not products (FEFO selling).
// CRITICAL: stock update must be `quantity = quantity - $qty WHERE quantity >= $qty`
//           and we assert rowCount === 1, else throw to roll back.
// SECURITY: cost_price is RLS-hidden from cashiers; don't SELECT it in cashier flows.
// GOTCHA: money is integer paise; never float.
```

## Validation Loop

### Level 1 — Syntax & Style
```bash
npm run typecheck && npm run lint
```
### Level 2 — Unit tests
```bash
npm run test    # pricing math, RBAC matrix, atomic-update guard
```
### Level 3 — Integration
```bash
npm run dev
# Log in as admin -> create product -> purchase stock -> POS sale -> check P&L.
# Log in as cashier -> confirm /accounting and /expenses return 403 and cost price is absent.
```

## Final Validation Checklist

- [ ] RLS enabled on all tables, all four verbs.
- [ ] Audit trigger fires on inventory + sales changes.
- [ ] Concurrency test passes (two simultaneous sales).
- [ ] Rollback test passes (failed sale leaves stock intact).
- [ ] `TASKS.md` updated.

## Anti-Patterns to Avoid

- ❌ read-then-write stock updates
- ❌ trusting a client-sent price/role/total
- ❌ `"use client"` on data-loading pages
- ❌ `any`
- ❌ a table without RLS
