# XSS Security Report

## Status: PASS

## Findings

- No `dangerouslySetInnerHTML` anywhere in the codebase.
- All user-supplied values (product names, customer names, expense descriptions) render as
  React text nodes, which are escaped by default.
- The CSP additionally blocks `object-src`, restricts `base-uri`, and sets `frame-ancestors`.

## What's at risk

Stored XSS in a product or customer name could run in an admin's session.

## Recommendations

1. If `dangerouslySetInnerHTML` is ever needed, sanitise with a vetted library and document why.
2. Keep the CSP tightening (nonces) on the pre-launch list.
