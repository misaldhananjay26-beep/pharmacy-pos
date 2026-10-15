# Secrets Exposure Security Report

## Status: PASS

## Findings

- No hardcoded secrets in the source tree (`security:scan` rule `no-hardcoded-secrets`).
- `.gitignore` excludes `.env.local`, `.env*.local`, and `.env` (only `.env.example` is tracked).
- `.env.example` contains placeholders only, never real values.
- No secret uses a `NEXT_PUBLIC_` prefix; the service-role key and `DATABASE_URL` are named
  without a client-exposing prefix and are read only in `server-only` modules.

## What's at risk

A leaked service-role key bypasses RLS entirely; a leaked `DATABASE_URL` grants direct
database access. Both are total compromise of the data model.

## What's already secure

- `SUPABASE_SERVICE_ROLE_KEY` is imported only by `src/lib/supabase/admin.ts` and
  `src/db/seed.ts`, both server-side.
- `.env.example` documents the boundary explicitly ("NEVER expose… do not prefix with
  NEXT_PUBLIC_").
- The `next.config.ts` sets `productionBrowserSourceMaps: false`.

## Recommendations (priority order)

1. Before the first deploy, rotate anything placed in `.env.local` (per the CVE-2025-66478
   advisory, since the app was built with a vulnerable framework version).
2. Add `gitleaks detect --source .` to CI to catch secrets in history.
3. Store production secrets in the host's encrypted env store (Vercel/host), never a file.

## Verification goals

- [x] `.env.local` is gitignored
- [x] no secret-like value under a `NEXT_PUBLIC_` prefix
- [x] `.env.example` has placeholders only
- [x] scanner reports 0 `no-hardcoded-secrets` / `no-client-secrets` errors
