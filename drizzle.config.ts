import { defineConfig } from "drizzle-kit";

// SECURITY: DATABASE_URL (with password) is server-only, loaded from .env, never committed.
export default defineConfig({
  schema: "./src/db/schema.ts",
  // Reason: supabase/migrations holds the human-reviewed baseline (0001-0003).
  // drizzle-kit writes *future* diffs to ./drizzle so the two never collide.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
