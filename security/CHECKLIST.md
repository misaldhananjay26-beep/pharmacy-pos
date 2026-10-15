# Security checklist (vibe-check 17 categories)

Adapted from `benavlabs/vibe-check` + `themusashimaru/vibe-coders-security-checklist` + `astoj/vibe-security`.
Run the audit before every release. For each category: write `security/reports/<CATEGORY>_REPORT.md`,
then `security/plans/<CATEGORY>_PLAN.md` with testable goals, fix, verify, and finally update
`security/AUDIT_SUMMARY.md`.

Run categories **in order**. The first five are where real breaches live.

| # | Category | Status | Notes |
|---|----------|--------|-------|
| 1 | SECRETS_EXPOSURE | ✅ | `.env` gitignored, no secrets in source, no secret under `NEXT_PUBLIC_`, `.env.example` placeholders only → `reports/SECRETS_EXPOSURE_REPORT.md` |
| 2 | DATABASE_ACCESS | ✅ | RLS on all 11 tables, policies for all verbs, no `USING (true)`; verified live → `reports/DATABASE_ACCESS_REPORT.md` |
| 3 | AUTH_MIDDLEWARE | ✅ | Session refreshed + coarse gate in middleware; per-page/action role checks; `getUser()` not `getSession()` → `reports/AUTH_MIDDLEWARE_REPORT.md` |
| 4 | ACCESS_CONTROL | ✅ | Every action `requireRole` first; ownership enforced; no self-promotion → `reports/ACCESS_CONTROL_REPORT.md` |
| 5 | FRONTEND_SECRETS | ✅ | Server keys server-only, no public source maps → `reports/FRONTEND_SECRETS_REPORT.md` |
| 6 | SSRF | ✅ | No user-supplied URL fetches exist in v1 |
| 7 | CSRF | ✅ | Mutations are Server Actions (same-origin, POST-only); httpOnly cookies → `reports/CSRF_CORS_REPORT.md` |
| 8 | SECURITY_HEADERS | ✅ | CSP + HSTS + nosniff + referrer + frame policies set; nonce tightening is a pre-launch task → `reports/SECURITY_HEADERS_REPORT.md` |
| 9 | CORS | ✅ | No permissive cross-origin policy → `reports/CSRF_CORS_REPORT.md` |
| 10 | RATE_LIMITING | ⚠️ | Code present, no production backend configured → `reports/RATE_LIMITING_REPORT.md` + `plans/RATE_LIMITING_PLAN.md` |
| 11 | SQL_INJECTION | ✅ | Drizzle + parameterised tagged templates only → `reports/SQL_INJECTION_REPORT.md` |
| 12 | XSS | ✅ | No `dangerouslySetInnerHTML`; React escaping + CSP → `reports/XSS_REPORT.md` |
| 13 | PAYMENT_WEBHOOKS | N/A | No online payments in v1 (POS is counter-sale) |
| 14 | FILE_UPLOADS | N/A | No uploads in v1; add magic-byte validation if product images arrive |
| 15 | ERROR_HANDLING | ✅ | Generic client errors, named business errors → `reports/ERROR_HANDLING_REPORT.md` |
| 16 | PASSWORD_HASHING | N/A | Delegated to Supabase Auth (bcrypt) |
| 17 | DEPENDENCIES | ✅ | CVE-2025-66478 (CVSS 10.0) fixed by pinning `next@15.5.28` → `reports/DEPENDENCIES_REPORT.md` |

## Live scan (before deploy)

```bash
python3 <vibe-check>/skills/vibe-check/scripts/check.py https://<staging-url> --json
```

Also run: `gitleaks detect --source .` and `npm audit`. A live scan is **evidence, not the audit** — confirm
every finding against the code and find the true source (app middleware vs `next.config.ts` vs host config).

## Report format

```markdown
# {Category} Security Report

## Status: CRITICAL / HIGH / MEDIUM / LOW / PASS

## Findings            # specific files/routes/configs, with code snippets
## What's at risk       # concrete attacker impact
## What's already secure
## Recommendations      # in priority order
```

## Plan format

```markdown
# {Category} Fix Plan

## Changes             # file -> change
## New files
## Verification goals   # ALL must be true
- [ ] specific, testable
## Manual verification (for the human)
```

## Pharmacy-specific invariants to check in every audit

- A cashier token cannot read `expenses` or `profit_and_loss` **even directly against Postgres** (RLS, not just UI).
- Cost price is invisible to cashiers at the DB level, not just hidden in the UI.
- Two concurrent sales of the last unit: exactly one succeeds, the other is rejected. Inventory never goes negative.
- Fail a sale mid-transaction: inventory is unchanged.
- Every stock/price change exists in `audit_logs` with actor + before/after.
