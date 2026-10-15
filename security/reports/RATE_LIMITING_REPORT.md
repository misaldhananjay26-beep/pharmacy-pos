# Rate Limiting Security Report

## Status: MEDIUM

## Findings

- `src/lib/rate-limit.ts` provides a limiter with an in-memory fallback and an optional
  Upstash Redis backend, but **no production backend is configured** (`.env.example` leaves
  `UPSTASH_*` empty).
- Login goes through Supabase Auth, which applies its own limits, but our own actions
  (e.g. POS lookups, expense creation) are not rate limited in a multi-instance deployment.
- An in-memory limiter does **not** hold across serverless instances.

## What's at risk

Brute-force or enumeration against app endpoints; resource exhaustion from rapid POS lookups.

## Recommendations (priority order)

1. Configure Upstash Redis via `UPSTASH_REDIS_REST_URL` / `_TOKEN` for any real deployment.
2. Apply the limiter to `searchSellableProducts` and the auth callback.
3. Never key the limiter on `X-Forwarded-For` alone (spoofable); use the platform's trusted
   client IP.

See `security/plans/RATE_LIMITING_PLAN.md`.
