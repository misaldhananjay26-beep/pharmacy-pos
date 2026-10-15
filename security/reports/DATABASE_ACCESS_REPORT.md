# Database Access Security Report

## Status: PASS (verified against the live database)

## Findings

- All 11 tables have RLS enabled; every table has at least one policy.
- Policies cover all four verbs where mutation is meaningful. `sales` / `sale_items` have
  insert+select only — no UPDATE/DELETE policy, so invoices are immutable.
- `audit_logs` is select-only for admins; writes come exclusively from a `SECURITY DEFINER`
  trigger. The app role's write privileges were revoked.
- Cost price is protected by **column privileges** on `batches` (and `purchase_items`).
- No `USING (true)` anywhere.

## Verified behaviour (live project, rolled back)

```
cashier_expenses_visible  = 0      (admin = 1)
cashier_cost_read         = DENIED (permission denied on cost_price_paise)
cashier_expense_insert    = DENIED (insufficient_privilege)
```

## What's at risk if this regressed

A cashier reading expenses/profit or cost price; forged sales; erased audit history.

## What's already secure

See `security/plans/phase-2-rls-verification.md` for the exact SQL and results.
