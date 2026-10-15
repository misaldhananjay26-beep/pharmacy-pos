# Frontend Secrets Security Report

## Status: PASS

## Findings

- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser.
  Both are safe to expose — they are enforced by RLS.
- `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are read only in `server-only` modules
  (`src/lib/supabase/admin.ts`, `src/db/index.ts`, `src/db/seed.ts`, `drizzle.config.ts`).
- `productionBrowserSourceMaps: false` in `next.config.ts`.
- No server key appears in a Client Component. Data mutations go through Server Actions.

## What's at risk

Shipping the service-role key to the browser would hand every visitor full RLS bypass.

## What's already secure

`security:scan` enforces the `no-client-secrets` rule (a secret-looking name under a
`NEXT_PUBLIC_` prefix fails the scan).
