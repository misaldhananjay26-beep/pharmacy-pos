import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SECURITY: bypasses RLS entirely.
 * Rules:
 *  - Never import this from a Client Component.
 *  - Never send its results (or the key) to the browser.
 *  - Use only for privileged auth admin operations (invite/create/delete users).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
