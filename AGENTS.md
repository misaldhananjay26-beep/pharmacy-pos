# AGENTS.md — Pharmacy POS

> Single source of truth for every AI agent (Claude Code, Cursor, Codex, OpenCode, Copilot) working in this repository.
> This file is loaded into the context window at the start of every session. Read it fully before touching code.

## 🔄 Project Awareness & Context

- **Always read this file first.** Then read `INITIAL.md` for the current feature spec and the relevant file in `PRPs/` for the task you were assigned.
- **Check `TASKS.md`** (create if missing) before starting work and mark items done immediately on completion.
- **Never assume missing context. Ask a question if a requirement is ambiguous.** Guessing is the most expensive failure mode in this repo.
- **Never hallucinate libraries or functions.** Confirm a package exists in `package.json` before importing it. Confirm a file/module path exists before referencing it.
- **Never delete or overwrite existing code** unless the task explicitly says to.
- **Architecture decisions are recorded in `docs/adr/`.** If you make one, add an ADR. If your task conflicts with an existing ADR, stop and ask.

## 🏥 What we are building

A pharmacy point-of-sale, inventory, and accounting system. It handles **regulated medicine stock**, **money**, and **personal/health data**, so correctness and least-privilege are not optional. Assume a cashier, a pharmacist, and an admin may be doing things at the same time.

## 🧱 Approved Stack — do not substitute

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router | 15.x |
| UI runtime | React | 19.x |
| Language | TypeScript | strict, `noImplicitAny`, `noUncheckedIndexedAccess` |
| Database | PostgreSQL (Supabase) | 17 |
| ORM | Drizzle ORM (drizzle-kit for migrations) | latest |
| Auth | Supabase Auth (`@supabase/ssr`) | latest |
| Authorization | Postgres Row-Level Security + server-side RBAC guard | — |
| UI kit | Tailwind CSS v4 + shadcn/ui + lucide-react | — |
| Server cache/data | TanStack Query v5 | 5.x |
| URL state | nuqs | latest |
| Charts | Recharts | latest |
| Validation | Zod (single schema shared by form + server action) | latest |

**Do not introduce** Redux, MobX, Prisma, NextAuth, tRPC, MySQL, MongoDB, or a REST layer AWS-style API gateway. Use Server Actions for mutations.

## 🧱 Code Structure & Modularity

- **Never create a file longer than 500 lines.** Split by responsibility.
- Group by feature under `src/`, not by file type.
- One Zod schema per entity in `src/lib/validations/`. Derive TS types with `z.infer` — never hand-write a duplicate interface.
- Server-only code lives in `src/server/**` and must start with `import "server-only"` if it touches the service-role key.
- Database access is **only** through `src/db/` (Drizzle). Never import `@supabase/supabase-js` into a component.

```
src/
  app/                     # routes, layouts, server components
  components/ui/           # shadcn primitives (generated, rarely edited)
  components/<feature>/    # feature UI
  db/
    index.ts               # drizzle client (server-only)
    schema.ts              # tables + relations
    migrations/            # generated SQL
  lib/
    auth/                  # session helpers, RBAC guard
    validations/           # zod schemas
    utils.ts
  server/
    actions/               # "use server" mutation entry points
    services/              # business logic, pure + testable
supabase/migrations/       # RLS policies, triggers, functions
```

## 🔐 Security Invariants (violating any of these is a CRITICAL bug)

1. **Every table has RLS enabled** with explicit policies for **all four verbs** (select/insert/update/delete). No `USING (true)` unless the row is genuinely public reference data (and then say why in a comment).
2. **Every Server Action calls `requireRole(...)` before doing anything else.** Authorization happens on the server. Hiding a button is UX, not security.
3. **Never trust client-sent money, quantity, price, tax, discount, or role.** Recompute totals from database rows inside the action.
4. **Money is integer paise (or minor units) in the DB.** Never `float`. Format only at the edge.
5. **All multi-row writes happen inside `db.transaction(...)`** — a sale inserts `sales`, `sale_items`, and decrements `inventory` atomically, or nothing happens.
6. **Stock decrements are atomic and guarded:** `UPDATE inventory SET quantity = quantity - $qty WHERE id = $id AND quantity >= $qty` and assert exactly one row changed. Never read-then-write.
7. **Validate every input with Zod on the server**, even if the form validated on the client.
8. **No secret reaches the client.** Only `NEXT_PUBLIC_*` values may be bundled, and they must never be secrets. The service-role key is server-only.
9. **Errors returned to users are generic.** Log detail server-side. Never surface a stack trace, SQL error, or key.
10. **Nothing sensitive in `localStorage`.** Auth lives in httpOnly cookies managed by Supabase.

## 🧪 Testing & Reliability

- Every new feature ships with tests. Each test file contains **at minimum: one happy path, one edge case, one failure case.**
- Business logic lives in `src/server/services/**` as pure functions so it can be unit tested without a database.
- Transactional flows get an integration test that **proves the rollback**: force the second statement to fail and assert the first was undone.
- After changing logic, check whether existing tests need updating.
- Validation is layered — see `PRPs/templates/prp_base.md` "Validation Loop". Run the loop and fix errors before declaring done.

## ✅ Task Completion

- Update `TASKS.md` the moment a task is done.
- Add anything you discovered but didn't fix to a **"Discovered During Work"** section in `TASKS.md`.
- A task is not done until: `npm run typecheck && npm run lint && npm run test` pass and you have manually exercised the flow in the browser.

## 📎 Style & Conventions

- Server Components by default. `"use client"` only for interactivity (POS cart, barcode capture, form controls, charts).
- SQL is lowercase keywords, snake_case identifiers, tables named as plural nouns.
- Currency and dates are formatted with `Intl` helpers in `src/lib/utils.ts`, never inline.
- Prefer `unknown` over `any`. If you truly need `any`, it requires a `// eslint-disable` with a one-line justification.

## 📚 Documentation & Explainability

- Comment the **why**, not the what. Prefix non-obvious decisions with `// Reason:`.
- Mark sharp edges with `// CRITICAL:`, `// GOTCHA:`, `// SECURITY:`.
- Public server actions get a short JSDoc block: who may call it, what it validates, what it returns on failure.

## 🧠 AI Behavior Rules

- Never assume missing context. Ask questions if uncertain.
- Never hallucinate libraries or functions. Verify imports against `package.json` and real file paths.
- Never delete or overwrite existing code unless explicitly instructed.
- Follow all rules in this file. When you propose code, restate which invariants from §Security it satisfies.
- Plan before coding. For any task larger than a single file, produce a short plan and **wait for approval** before implementing.
