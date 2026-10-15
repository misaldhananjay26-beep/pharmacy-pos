# Security Headers Security Report

## Status: PASS (CSP to be tightened with nonces before launch)

## Findings

`next.config.ts` sets, on every response:

| Header | Value |
| --- | --- |
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(self), microphone=(), geolocation=()` |
| X-Powered-By | removed (`poweredByHeader: false`) |

## What's at risk

A weak or absent CSP makes XSS far more damaging; missing HSTS allows downgrade attacks.

## Recommendations (priority order)

1. Replace `'unsafe-inline'` for scripts with a per-request nonce (Next's `headers()` cannot
   do this in the config file — it needs middleware). Roll out as Report-Only first.
2. Add `upgrade-insecure-requests` once the app is HTTPS-only in production.
