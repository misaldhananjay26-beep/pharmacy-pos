import "server-only";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reason: Supabase's transaction pooler (pgbouncer) does not support prepared statements.
const client = postgres(connectionString, { prepare: false, max: 10 });

/**
 * Privileged Drizzle client. Use it ONLY for admin-style reads that you deliberately
 * scope yourself; for anything a signed-in user should see, prefer `withUser`/`withIdentity`
 * so RLS actually filters rows.
 *
 * GOTCHA: the runtime role (`app_rls`) is NOINHERIT and holds no table grants, so a bare
 * `db.query.*` call is denied by RLS. That is intentional (fail-closed).
 */
export const db = drizzle(client, { schema });

export type Database = typeof db;

export type AppUser = {
  id: string;
  email: string;
  role: "admin" | "pharmacist" | "cashier";
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Run `fn` inside a transaction that impersonates the given JWT claims. */
async function withClaims<T>(claims: Record<string, unknown>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const serialized = JSON.stringify(claims);
  return db.transaction(async (tx) => {
    // Reason: `set_config('role', …, true)` is the `SET LOCAL ROLE` equivalent; it drops the
    // owner's RLS bypass for the rest of the transaction. Both values are local and auto-reset.
    await tx.execute(sql`select set_config('role', 'authenticated', true)`);
    await tx.execute(sql`select set_config('request.jwt.claims', ${serialized}, true)`);
    return fn(tx);
  });
}

/**
 * Run a callback with Postgres session variables that make Row-Level Security apply to
 * *this* connection as the given user:
 *   - `request.jwt.claims` drives auth.uid() / auth.jwt() (what the RLS policies read)
 *   - `role = authenticated` drops the owner's RLS bypass, so policies actually bite
 * Both are `is_local = true`, i.e. scoped to the surrounding transaction and auto-reset.
 *
 * SECURITY: this is the defence-in-depth layer. Even if a Server Action forgot its
 * requireRole() guard, RLS still filters by the caller's role and row ownership.
 */
export async function withUser<T>(user: AppUser, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withClaims(
    {
      sub: user.id,
      email: user.email,
      role: "authenticated",
      user_role: user.role,
      app_metadata: { role: user.role },
    },
    fn,
  );
}

/**
 * Like `withUser`, but for the two moments we know an identity before we know its role:
 * resolving the session on each request, and choosing a post-sign-in landing page.
 * Policies only ever read `auth.uid()`, so `{ sub }` is enough.
 */
export async function withIdentity<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withClaims({ sub: userId, role: "authenticated" }, fn);
}

export { schema };
