# ADR-0001 — Row-Level Security is the security boundary

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
We are building a pharmacy POS that handles regulated stock, money, and health-adjacent
data. A cashier must not be able to read expenses or profit information, and that must hold
even if a Server Action forgets its guard, or the client library is swapped out.

Application-layer checks (`requireRole`) are a good second fence but are one refactor away
from being bypassed. We needed an enforcement point that cannot be skipped.

## Decision
Enforce authorization in Postgres with **Row-Level Security on every table, for every verb**.
`src/db/index.ts#withUser()` runs app queries as the `authenticated` role with the caller's
JWT claims, so policies apply. Application guards remain as defence in depth, not as the
boundary.

No table is allowed `using (true)` unless it is genuinely public reference data (and the
migration must say why).

## Consequences
- A missing `requireRole` is no longer a data leak; RLS still filters rows.
- Every new table must ship with policies in the same migration (see `security/CHECKLIST.md`).
- Reads go through `withUser`, which adds a small per-query transaction overhead. Accepted.
- We proved the model end-to-end: a simulated cashier saw `0` expense rows and was blocked
  from inserting one; an admin saw the row.
