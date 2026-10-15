# Security audit summary

_Date: 2026-10-15 · Live project ref: `cwemyozgjrusatfqvonn`_

This is the human-readable summary of the security posture. The generated,
machine-checked report lives in [`security/reports/`](reports/), produced by
`npm run security:scan`.

## What was verified, and how

| # | Claim | Method | Result |
| --- | --- | --- | --- |
| 1 | Every table has RLS enabled | `list_tables` + Supabase security advisors | ✅ all 11 tables |
| 2 | Cashier cannot read expenses | Simulated a cashier JWT in SQL | ✅ `0` rows (admin saw `1`) |
| 3 | Cashier cannot insert an expense | Simulated insert as cashier | ✅ `DENIED` |
| 4 | Cashier cannot read cost price | `select cost_price_paise` as cashier | ✅ `permission denied` |
| 5 | Audit trigger fires on writes | `audit_logs` rows after INSERT/UPDATE/DELETE | ✅ |
| 6 | Function surface hardened | Supabase advisor `anon/authenticated security definer` | ✅ only 3 intentional helpers remain |
| 7 | No secrets in the client bundle | `security:scan` rule `no-client-secrets` | ✅ |
| 8 | Checkout is race-safe | Guarded `UPDATE … WHERE quantity >= n` + assert 1 row (code review + unit tests) | ✅ |

### The RLS proof (claim 2)

```
cashier_expenses_visible  = 0
cashier_cost_read         = DENIED
cashier_expense_insert    = DENIED
admin_expenses_visible    = 1
```

The test ran inside a transaction that was rolled back, so no data was left behind.

## Advisors

`get_advisors(type: security)` returns one remaining class of warning:
`authenticated_security_definer_function_executable` for `current_user_role`, `has_role`,
and `batch_cost_price`. These are **intentional**: signed-in users must be able to call them
(policies and privileged reads depend on them), and `anon` has been revoked from all three.
All other definer functions are trigger-only and unreachable over RPC.

## Known gaps / follow-ups

- **Service-role key & DB password** must be copied from the dashboard into `.env.local`
  before seeding or `drizzle-kit push`. The MCP surface does not expose them.
- **Sign-ups are not enabled** as a flow; users are provisioned by an admin. The
  `handle_new_user` trigger deliberately ignores any role in signup metadata to prevent
  self-promotion.
- **No rate limiting in production yet.** `src/lib/rate-limit.ts` is in place with an
  in-memory fallback; wire Upstash for a real deployment.
- **Void/refund** is out of scope; invoices are immutable by design (no UPDATE/DELETE
  policies). A future refund would be a new, additive document, not an edit.

## How to re-run

```bash
npm run security:scan        # static guardrail scan → security/reports/scan-YYYY-MM-DD.md
npm run verify               # typecheck + lint + unit tests
```

RLS itself is verified against the live database; the SQL used is in
[`plans/phase-2-rls-verification.md`](plans/phase-2-rls-verification.md).
