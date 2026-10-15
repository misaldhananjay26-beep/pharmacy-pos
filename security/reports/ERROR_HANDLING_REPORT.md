# Error Handling Security Report

## Status: PASS

## Findings

- Server Actions return a discriminated `{ ok, message }` result, never a raw error.
- `guardErrorToMessage()` maps internal errors (`UNAUTHENTICATED`, `FORBIDDEN`) to generic
  user text and everything else to "Something went wrong."
- Stack traces, SQL errors, and keys are not surfaced to clients.
- Expected business failures are named (`INSUFFICIENT_STOCK`, `INVALID_ITEM`,
  `INVALID_DISCOUNT`) and translated to friendly copy in `createSale`.

## What's at risk

Verbose errors leak schema and infrastructure detail to an attacker.

## Recommendations

1. Add centralised server-side logging with a request id (and never log secrets/PII).
2. Ensure the production runtime does not return framework debug pages.
