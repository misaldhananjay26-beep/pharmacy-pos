# SQL Injection Security Report

## Status: PASS

## Findings

- All database access goes through Drizzle with parameterised queries.
- The only hand-written SQL uses tagged templates with bound parameters, e.g. the invoice
  sequence and the guarded stock decrement:
  ```ts
  sql`${batches.quantity} - ${l.quantity}`
  sql`select 'INV-' || … || nextval('sale_invoice_seq')::text …`
  ```
  Table/column identifiers are never built from user input.
- Zod validates every Server Action input before it reaches the database.
- The one `format(...)` in migrations builds a trigger from a fixed in-code array of table
  names — not user input.

## What's at risk

Injection into the ledger/money tables is a data-integrity and confidentiality disaster.

## What's already secure

The `security:scan` rule `parameterised-sql` flags SQL templates that interpolate into a
`where`/`like` clause for human review.
