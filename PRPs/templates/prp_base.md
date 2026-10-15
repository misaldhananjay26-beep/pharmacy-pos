---
name: prp_base
description: Reusable template for a Product Requirement Prompt (PRP). Copy to PRPs/<feature>.md and fill in.
---

# PRP — <Feature name>

> Global rules: follow every rule in [`AGENTS.md`](../../AGENTS.md) and [`.cursorrules`](../../.cursorrules).
> Core principles: **Context is King**, **Validation Loops**, **Information Dense**, **Progressive Success**.

## Goal

One paragraph. What will exist when this is done, and how we know.

## Why

- Business value.
- Which user role benefits.
- What breaks if we get it wrong.

## What

- [ ] Deliverable 1
- [ ] Deliverable 2

### Success Criteria

- [ ] User can <do the thing> and sees <observable result>.
- [ ] Invalid input is rejected server-side with a friendly message.
- [ ] `npm run typecheck && npm run lint && npm run test` pass.

## All Needed Context

### Documentation & References

```yaml
- url: <link>
  why: <why the agent must read this>
  section: <specific section>
  critical: <the one thing to get right>
- file: src/...
  why: <pattern to follow or gotcha to avoid>
```

### Current Codebase tree

```
<tree snapshot>
```

### Desired Codebase tree

```
src/...   # responsibility of each new file
```

### Known Gotchas

```ts
// CRITICAL: <gotcha>
// GOTCHA: <library quirk>
// PATTERN: <existing pattern to mirror>
```

## Implementation Blueprint

### Data models

```ts
// zod schemas + drizzle tables
```

### Tasks (in order)

```yaml
- CREATE src/...:
    - MIRROR pattern from: src/...
    - KEEP error handling identical

- MODIFY src/...:
    - FIND: <pattern>
    - INJECT after: <anchor>
    - PRESERVE: <what must not change>
```

### Integration Points

```yaml
DATABASE:  migration + RLS policies
CONFIG:    env var added to .env.example
ROUTES:    app/<path>/page.tsx
```

## Validation Loop

Run these **in order**. Fix errors before moving on.

### Level 1 — Syntax & Style

```bash
npm run typecheck   # Expected: no errors
npm run lint        # Expected: no warnings
```

### Level 2 — Unit tests

```bash
npm run test        # happy path + edge case + failure case
```

### Level 3 — Integration / manual

```bash
npm run dev
# Exercise the flow in the browser. Expected: <result>
# If it fails: read the server log, do not guess.
```

## Final Validation Checklist

- [ ] All tests pass.
- [ ] Lint and typecheck clean.
- [ ] Manually exercised the happy path and one error path.
- [ ] Security invariants in AGENTS.md §Security upheld (state which).
- [ ] `TASKS.md` updated.
- [ ] Docs/README updated if behaviour changed.

## Anti-Patterns to Avoid

- ❌ Don't invent patterns when an existing one works.
- ❌ Don't skip validation because "it should work".
- ❌ Don't ignore failing tests.
- ❌ Don't hardcode values that should be config.
- ❌ Don't catch all exceptions — be specific.
- ❌ Don't write stock math as read-then-write.
