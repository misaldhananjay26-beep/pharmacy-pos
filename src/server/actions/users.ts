"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withUser } from "@/db";
import { profiles } from "@/db/schema";
import { guardErrorToMessage, requireRole } from "@/lib/auth/guard";
import { roleSchema } from "@/lib/validations";

import { fail, ok, type ActionResult } from "./types";

/** WHO: admin only. */
export async function listUsers() {
  const user = await requireRole(["admin"]);
  return withUser(user, async (tx) =>
    tx
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .orderBy(asc(profiles.fullName)),
  );
}

/**
 * Change a user's role.
 * WHO: admin. Writes to OUR profiles table (source of truth for RLS). Also mirrors the
 * role into auth.app_metadata when the service-role key is available, so the UI can land
 * the user on the right page. A user cannot change their own role (prevents self-promotion).
 */
export async function setUserRole(
  userId: string,
  role: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireRole(["admin"]);
    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) return fail("Unknown role.");

    if (userId === admin.id && parsed.data !== "admin") {
      return fail("You cannot remove your own admin access.");
    }

    await withUser(admin, async (tx) => {
      await tx
        .update(profiles)
        .set({ role: parsed.data, updatedAt: new Date() })
        .where(eq(profiles.id, userId));
    });

    // Best-effort metadata sync; harmless if the service key is absent.
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      await createSupabaseAdminClient().auth.admin.updateUserById(userId, {
        app_metadata: { role: parsed.data },
      });
    } catch {
      // Profiles remains the authoritative source for RLS regardless.
    }

    revalidatePath("/users");
    return ok({ id: userId });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}

/** WHO: admin only. */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireRole(["admin"]);
    if (userId === admin.id && !isActive) return fail("You cannot deactivate yourself.");

    await withUser(admin, async (tx) => {
      await tx.update(profiles).set({ isActive, updatedAt: new Date() }).where(eq(profiles.id, userId));
    });

    revalidatePath("/users");
    return ok({ id: userId });
  } catch (err) {
    return fail(guardErrorToMessage(err));
  }
}
