/**
 * Seed runner — `npm run db:seed`.
 *
 * Applies `supabase/seed.sql` through a PRIVILEGED database connection, so it must
 * connect as a database owner (not the app's `app_rls` role, which is subject to RLS).
 *
 * Required (server-only, from .env.local):
 *   SEED_DATABASE_URL   e.g. postgresql://<db-owner>@db.<ref>.supabase.co:5432/postgres
 *
 * SECURITY:
 *   • This runs offline as a trusted operator — never from a request.
 *   • It does NOT use the service-role key; auth users are inserted by SQL (see seed.sql).
 *   • Deliberately does not import src/db/index.ts, whose "server-only" marker throws
 *     outside the Next.js runtime and which is meant for the least-privileged app role.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import postgres from "postgres";

function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      // try the next file
    }
  }
}

loadEnv();

const connectionString = process.env.SEED_DATABASE_URL ?? process.env.DATABASE_URL;
const isPrivileged =
  !!connectionString && !connectionString.includes("app_rls");

if (!connectionString) {
  console.error(
    "SEED_DATABASE_URL is not set. Add a PRIVILEGED (database owner) connection string to .env.local.",
  );
  process.exit(1);
}

if (!isPrivileged) {
  console.error(
    "Refusing to seed: the connection string looks like the app role (app_rls), " +
      "which is subject to RLS. Set SEED_DATABASE_URL to a database owner connection string.",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const seedFile = join(here, "..", "..", "supabase", "seed.sql");

async function main(): Promise<void> {
  const seedSql = readFileSync(seedFile, "utf8");

  // Reason: seed.sql contains multiple statements and dollar-quoted bodies, so it is
  // sent as one simple (non-prepared) query.
  const sql = postgres(connectionString!, { prepare: false, max: 1 });

  try {
    console.log(`Applying ${seedFile} …`);
    await sql.unsafe(seedSql);

    const rows = await sql<{ users: number; products: number; batches: number }[]>`
      select
        (select count(*)::int from public.profiles) as users,
        (select count(*)::int from public.products) as products,
        (select count(*)::int from public.batches) as batches
    `;
    const summary = rows[0];

    console.log(
      `Done. profiles=${summary?.users ?? 0} products=${summary?.products ?? 0} batches=${summary?.batches ?? 0}`,
    );
    console.log("Sign in with admin@pharmacy.local / pharmacist@pharmacy.local / cashier@pharmacy.local");
    console.log("Default password: Pharmacy#12345");
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
