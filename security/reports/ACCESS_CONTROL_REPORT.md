# Access Control Security Report

## Status: PASS

## Findings

- Every Server Action calls `requireRole([...])` as its first statement
  (`sales`, `purchases`, `products`, `expenses`, `users`, `pos`).
- Writes **and** reads are guarded; `listExpenses` / `getProfitAndLoss` are admin-only.
- Ownership is enforced in addition to role: `sales_select` limits a cashier to
  `created_by = auth.uid()`, and `sale_items_insert` only allows items onto your own sale.
- Role is never read from the client. `getCurrentUser()` reloads it from `profiles` in the DB.
- Self-promotion is blocked two ways: `setUserRole` refuses to change your own admin access,
  and the `prevent_role_escalation` trigger rejects non-admins touching `role`/`is_active`.

## What's at risk

Broken access control is the #1 web risk (OWASP A01). Here it would mean a cashier acting as
an admin, or reading another cashier's till.

## What's already secure

App guards are backed by RLS, so a forgotten guard does not become a breach (ADR-0001).

## Recommendations

1. Add an integration test that calls each action as the wrong role and asserts `FORBIDDEN`.
2. Add an integration test for concurrent last-unit sales (tracked in `TASKS.md`).
