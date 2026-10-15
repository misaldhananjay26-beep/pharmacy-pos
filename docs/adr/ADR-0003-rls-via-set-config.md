# ADR-0003 — RLS for a Drizzle connection via `set_config`

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
We want RLS to apply to Drizzle (`postgres.js`) queries, but Drizzle connects with a single
database user. Supabase's usual pattern is the PostgREST client, which sets the `role` and
`request.jwt.claims` for you. With a direct connection we must set them ourselves.

## Decision
`withUser(user, fn)` wraps a transaction and runs:
```sql
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":…,"role":"authenticated"}', true);
```
Both are `is_local = true`, so they reset when the transaction ends and cannot leak to the
next request on a pooled connection. `role = authenticated` drops the owner's RLS bypass, and
`request.jwt.claims` is what `auth.uid()` / `auth.jwt()` read inside the policies.

The privileged `db` client (owner) is reserved for migrations, seeding, and actions that have
already passed `requireRole`.

## Consequences
- Verified on the live project: within `withUser`, `current_user_role()` resolves and RLS
  filters correctly.
- `authenticated` needs `usage` on the schema, table grants, and `usage, select` on
  `sale_invoice_seq` (the POS invoice sequence). Captured in `0002_rls_audit.sql`.
- If a query must bypass RLS it must use `db`, and that should be justified in a comment.
- `SET LOCAL` requires a transaction; `withUser` always opens one, which also gives us the
  atomicity we need for checkout.
