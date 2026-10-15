#!/usr/bin/env node
/**
 * security-scan.mjs — a fast, dependency-free guardrail scan.
 *
 * It is deliberately simple and explainable (see security/CHECKLIST.md for the "why").
 * It looks for the classes of mistake an AI agent is most likely to make in this repo:
 *   1. hardcoded secrets / service-role keys
 *   2. secrets published to the client (wrong env prefix)
 *   3. missing "use server" on files that export server actions
 *   4. `select *` reads (bypass rows you did not mean to expose)
 *   5. `any` types and `@ts-ignore`
 *   6. console logging in server code (leaks detail into logs)
 *   7. a table created without `enable row level security`
 *   8. raw SQL string interpolation into a query
 *
 * Exit code 1 if there is at least one ERROR. Warnings do not fail the run.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "coverage", ".turbo", "drizzle",
]);

const results = [];
const add = (level, rule, file, line, message) =>
  results.push({ level, rule, file, line, message });

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql"].includes(extname(full))) {
      scanFile(full);
    }
  }
}

function rel(f) {
  return relative(ROOT, f).replace(/\\/g, "/");
}

const SECRET_PATTERNS = [
  { re: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][A-Za-z0-9._-]{20,}["']/, name: "hardcoded service-role key" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, name: "hardcoded JWT" },
  { re: /\bsk-[A-Za-z0-9]{20,}/, name: "hardcoded API secret (sk-)" },
  { re: /postgres(ql)?:\/\/[^:\s"']+:[^@\s"']+@/, name: "hardcoded DB connection string with password" },
];

const CLIENT_PREFIX_SECRET = /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*/;

function scanFile(file) {
  const relPath = rel(file);
  const src = readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  const isServerDir = /^src\/server\//.test(relPath);
  const isAction = /\/actions\//.test(relPath);
  const isSql = extname(file) === ".sql";
  // The scanner's own source contains these patterns as literals; do not flag it.
  const isScanner = relPath === "scripts/security-scan.mjs";

  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();
    // Allow the scanner + docs to mention the patterns.
    const inDoc = /security-scan|CHECKLIST|\.md$/.test(relPath);

    if (!inDoc) {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(raw)) add("error", "no-hardcoded-secrets", relPath, line, `Possible ${p.name}.`);
      }
    }
    if (CLIENT_PREFIX_SECRET.test(raw) && !inDoc) {
      add("error", "no-client-secrets", relPath, line, "Secret-looking value uses a NEXT_PUBLIC_ (client-exposed) prefix.");
    }
    if (/\.select\(\s*\)|select\s+\*\s+from/i.test(raw) && !/count\(\*\)/i.test(raw)) {
      add("warn", "no-select-star", relPath, line, "`select *` can expose columns you did not intend.");
    }
    if (/\bas\s+any\b|<any>|:\s*any\b\s*([,;)\]}>|=&]|$)/.test(raw) && !isScanner) {
      add("warn", "no-any", relPath, line, "Avoid `any`; prefer `unknown` + a narrow check.");
    }
    if (/@ts-ignore/.test(raw) && !isScanner) {
      add("warn", "no-ts-ignore", relPath, line, "`@ts-ignore` hides real type errors; use @ts-expect-error with a reason.");
    }
    if (/console\.(log|debug|info)\(/.test(raw) && isServerDir && !/seed\.ts/.test(relPath)) {
      add("warn", "no-server-console", relPath, line, "Console logging in server code can leak data into logs.");
    }
    if (/sql`[^`]*\$\{(?!.*(eq|sql|placeholder))/i.test(raw) && /where|like/i.test(raw)) {
      // crude heuristic; SQL template interpolation of user input is the smell.
      add("warn", "parameterised-sql", relPath, line, "Check this SQL template interpolates only trusted/column values.");
    }
    if (isSql && /create table/i.test(raw) && /public\.\w+/.test(raw)) {
      // handled after the loop via table tracking
    }
  });

  // 3. Server-action files must declare "use server".
  if (isAction && !isSql && !/^\s*["']use server["']/m.test(src)) {
    add("error", "use-server-directive", relPath, 1, 'A file under server/actions must start with "use server".');
  }

  // 8. RLS coverage: every `create table public.x` must be followed by an enable.
  if (isSql) {
    const created = [...src.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]);
    for (const table of created) {
      const enabled = new RegExp(`alter table public\\.${table}\\s+enable row level security`, "i").test(src);
      if (!enabled) {
        // Might be enabled in a later migration; downgrade to warn and flag it.
        add("warn", "rls-enabled", relPath, 1, `Table public.${table} has no ENABLE ROW LEVEL SECURITY in this file.`);
      }
    }
    // Raw string interpolation into a policy/function is a smell.
    if (/format\(/.test(src) && /%1\$s/.test(src)) {
      // expected: our trigger loop uses format with a fixed table-name array; not user input.
    }
  }
}

// Cross-file check for the migration RLS set.
function checkRlsAcrossMigrations() {
  const dir = join(ROOT, "supabase", "migrations");
  let allSql = "";
  try {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".sql")) allSql += readFileSync(join(dir, f), "utf8") + "\n";
    }
  } catch {
    return;
  }
  const created = [...allSql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]);
  for (const table of new Set(created)) {
    const enabled = new RegExp(`alter table public\\.${table}\\s+enable row level security`, "i").test(allSql);
    if (!enabled) add("error", "rls-enabled", `supabase/migrations`, 0, `Table public.${table} is never RLS-enabled in any migration.`);
    else {
      // Remove the per-file warning for this table since it's covered elsewhere.
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i].rule === "rls-enabled" && results[i].message.includes(`public.${table} has no`)) {
          results.splice(i, 1);
        }
      }
    }
  }
}

console.log("Running security scan…\n");
for (const target of ["src", "supabase", "scripts", "."]) {
  const p = join(ROOT, target);
  try {
    statSync(p);
  } catch {
    continue;
  }
  // Only walk top-level once for ".".
  if (target === ".") {
    for (const entry of readdirSync(ROOT)) {
      if (entry === "src" || entry === "supabase" || SKIP_DIRS.has(entry)) continue;
      const full = join(ROOT, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if ([".ts", ".tsx", ".mjs", ".js", ".sql"].includes(extname(full))) scanFile(full);
    }
  } else {
    walk(p);
  }
}
checkRlsAcrossMigrations();

// De-duplicate: walking both "." and named dirs can visit the same file twice.
const seen = new Set();
const deduped = results.filter((r) => {
  const key = `${r.level}|${r.rule}|${r.file}|${r.line}|${r.message}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
results.length = 0;
results.push(...deduped);

const errors = results.filter((r) => r.level === "error");
const warns = results.filter((r) => r.level === "warn");

const report = [
  `# Security scan report`,
  ``,
  `_Generated ${new Date().toISOString()} by scripts/security-scan.mjs_`,
  ``,
  `- Errors: **${errors.length}**`,
  `- Warnings: **${warns.length}**`,
  ``,
  `## Findings`,
  ``,
  ...(results.length
    ? results
        .map((r) => `- [${r.level.toUpperCase()}] \`${r.rule}\` — ${r.file}${r.line ? ":" + r.line : ""} — ${r.message}`)
        .map((s) => s)
    : ["- None. 🎉"]),
  ``,
].join("\n");

try {
  mkdirSync(join(ROOT, "security", "reports"), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ROOT, "security", "reports", `scan-${stamp}.md`), report);
} catch {
  // report writing is best-effort
}

for (const r of results) {
  console.log(`${r.level === "error" ? "✖" : "▲"} [${r.rule}] ${r.file}${r.line ? ":" + r.line : ""} — ${r.message}`);
}
console.log(`\n${errors.length} error(s), ${warns.length} warning(s). Report written to security/reports/.`);

process.exit(errors.length > 0 ? 1 : 0);
