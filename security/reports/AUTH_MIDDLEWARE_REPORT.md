# Auth Middleware Security Report

## Status: PASS

## Findings

- `src/middleware.ts` refreshes the Supabase session cookie and applies a coarse gate:
  unauthenticated users are redirected to `/login` for every non-public path.
- Middleware cannot read the `profiles` table (edge runtime), so it does **not** decide roles.
  That is intentional: fine-grained authorization is done per page (`requirePageRole`) and
  per action (`requireRole`), and finally by RLS.
- `getCurrentUser()` uses `supabase.auth.getUser()`, which validates the JWT with the auth
  server. It does **not** trust `getSession()` for authorization.
- Cookies are httpOnly and managed by `@supabase/ssr`; nothing sensitive is in `localStorage`.

## What's at risk

Trusting an unverified session cookie would allow forged identities.

## What's already secure

- Public prefixes are an explicit list (`/login`, `/auth`, `/api/health`).
- The matcher excludes static assets to avoid needless auth traffic.
- A missing or deactivated profile resolves to `null`, i.e. signed-out.

## Recommendations

1. Add CSRF protection to any future cookie-authenticated REST endpoints (Server Actions are
   already protected by Next's origin checks).
