# ADR-0002 — Money is integer minor units (paise)

- **Status:** Accepted
- **Date:** 2026-10-15

## Context
Floating point money drifts. A pharmacy reconciles every rupee; a rounding error at scale is
a real accounting bug, and GST reporting must be exact.

## Decision
Store all money as **integer paise** (`*_paise` columns). Store GST as **basis points**
(`gst_rate_bp`, so `1200 = 12.00%`). Convert to a display string only at the edge via
`formatINR()` in `src/lib/utils.ts`. Forms accept rupees and convert once with
`rupeesToPaise()`.

## Consequences
- Arithmetic is exact integer math; totals are rounded once per line, not per intermediate step.
- Every new money column must end in `_paise`, and every model money field in `Paise`.
- A reviewer can grep for `float`/`number` money bugs — there should be none.
