# Rate Limiting Fix Plan

## Changes

| File | Change |
| --- | --- |
| `.env.local` (operator) | Provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` |
| `src/lib/rate-limit.ts` | Confirm Redis path is selected when env is present; fail closed in prod if absent |
| `src/server/actions/pos.ts` | Wrap `searchSellableProducts` with the limiter (per user, per window) |
| `src/app/auth/callback/route.ts` (future) | Limit auth callbacks per IP |

## New files

- None required.

## Verification goals — ALL must be true

- [ ] With Upstash configured, N+1 rapid calls to the limited action return `429`.
- [ ] The limiter is keyed on the authenticated user id, not a spoofable header.
- [ ] In production without a Redis backend, the limiter refuses rather than silently allowing.
- [ ] Dev still works with the in-memory fallback.

## Manual verification (for the human)

1. Set the two `UPSTASH_*` vars in `.env.local`.
2. Run `npm run dev`, log in, and fire the limited action in a loop beyond the window.
3. Confirm the `429` and that normal usage is unaffected.
