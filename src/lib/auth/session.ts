import "server-only";

import { eq } from "drizzle-orm";

import { withIdentity, type AppUser } from "@/db";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolve the current user from the verified Supabase session, then load their role
 * from OUR database. The role is never read from the client.
 * Returns null when signed out OR when the profile is deactivated/missing.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();

  // SECURITY: getUser() validates the JWT with the auth server. Do NOT use getSession()
  // for authorization — it trusts a cookie that the client could tamper with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Reason: we know the identity here but not yet the role, so use withIdentity() to set
  // auth.uid(). The profiles_select policy then returns exactly this user's row.
  const row = await withIdentity(user.id, async (tx) =>
    tx.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: { id: true, email: true, role: true, isActive: true },
    }),
  );

  if (!row || !row.isActive) return null;

  return { id: row.id, email: row.email, role: row.role };
}
