# ADR-0004 — Cost price is protected with column privileges, not just RLS

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
A cashier needs to read stock (`batches`) to sell, but must not read what the pharmacy paid
(`cost_price_paise`). RLS is row-level: it can hide whole rows, not columns. Hiding the column
in the UI is not a security control.

## Decision
Keep the `batches` table readable by all roles at the row level, but **revoke the
`cost_price_paise` column** from `authenticated` and re-grant only the safe columns. Because
a table-level `SELECT` grant would override a column-level revoke, the migration drops the
table-level `SELECT` first, then grants explicit columns.

Privileged code reads cost through `public.batch_cost_price(batch_id)`, a `SECURITY DEFINER`
function that returns `NULL` unless the caller is an admin or pharmacist.

The same treatment is applied to `purchase_items.cost_price_paise` for defence in depth.

## Consequences
- A cashier querying cost gets `permission denied`, verified on the live project.
- Any future `select()` that includes cost must go through the function, or it will error loudly.
  This is intentional: it makes the exposure impossible to do by accident.
- All existing reads of `batches` select explicit columns, so nothing broke.
