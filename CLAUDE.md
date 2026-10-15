# CLAUDE.md

This project keeps a single, tool-agnostic source of truth for AI agents.

👉 **Read [`AGENTS.md`](./AGENTS.md) in full before doing anything.**

Supporting context:
- [`INITIAL.md`](./INITIAL.md) — the current feature specification (FEATURE / EXAMPLES / DOCUMENTATION / OTHER CONSIDERATIONS).
- [`PRPs/`](./PRPs) — Product Requirement Prompts: phased, testable task specs. Start from `PRPs/templates/prp_base.md`.
- [`security/CHECKLIST.md`](./security/CHECKLIST.md) — the security audit we run before any release.
- [`TASKS.md`](./TASKS.md) — live task board.

Quick rules (details in AGENTS.md):
1. Server Components by default; `"use client"` only for interactivity.
2. All writes via Server Actions guarded by `requireRole(...)`.
3. All multi-table writes in `db.transaction(...)`.
4. Stock via guarded atomic `UPDATE ... WHERE quantity >= qty`.
5. Zod on every server input; no `any`.
6. RLS on every table, all four verbs.
7. Plan first, wait for approval, then implement.
