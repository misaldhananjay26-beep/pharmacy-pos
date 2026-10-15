# CSRF & CORS Security Report

## Status: PASS

## Findings

- Mutations are **Server Actions**, which Next.js protects with same-origin checks and
  POST-only semantics; there are no state-changing GET routes.
- Auth cookies are httpOnly and scoped/managed by `@supabase/ssr`. `SameSite` is applied by
  the Supabase cookie defaults.
- CORS: the app serves its own origin and does not define a permissive CORS policy. There is
  no `Access-Control-Allow-Origin: *` with credentials.
- Data access is via Server Actions/Drizzle, not a public REST surface, so there is no
  cross-origin API to over-permit.

## What's at risk

CSRF could let a malicious page trigger a sale or expense as a logged-in user.

## Recommendations

1. If any cookie-authenticated REST endpoint is added, add an explicit CSRF token and an
   allowlist-based CORS policy with no wildcard.
