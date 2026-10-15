# Dependencies Security Report

## Status: FIXED (high → patched)

## Findings

`npm install` warned that the pinned framework version was vulnerable:

```
npm warn deprecated next@15.1.0: This version has a security vulnerability.
  Please upgrade to a patched version. See https://nextjs.org/blog/CVE-2025-66478
```

- **CVE-2025-66478** (downstream of React CVE-2025-55182, "React2Shell"), CVSS **10.0**.
- Affects Next.js App Router with React Server Components (Next.js 15.x and 16.x).
- Allows **remote code execution** when processing attacker-controlled requests.
- Patched in 15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8, 15.5.7, 16.0.7.

## What's at risk

RCE on the server is game over: an attacker could read environment variables (including the
service-role key and `DATABASE_URL`), exfiltrate data, or pivot. This is the single most
severe issue found in the project.

## What's already secure

- The exploit requires the App Router + RSC, which we use, so the app *was* exposed.
- Nothing in the codebase worked around or suppressed the warning.

## Fix

Pinned `next` and `eslint-config-next` to **15.5.28** (the patched 15.x backport), then
re-ran `npm install`. Confirmed by `npm run typecheck` / `build`.

> Per the advisory: if the app ran unpatched while reachable, rotate secrets. This app has
> not been deployed, so no rotation is required yet — but rotate anything you put in
> `.env.local` before the first deploy.

## Remaining

- `eslint@8` is deprecated (superseded by eslint 9 flat config). Low risk; tracked in `TASKS.md`.
- Keep the lockfile committed and re-run `npm audit` before every release.
