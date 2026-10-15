"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { withIdentity } from "@/db";
import { profiles } from "@/db/schema";
import { HOME_FOR_ROLE } from "@/lib/auth/roles";
import { loginRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/lib/validations";

import { fail, ok, type ActionResult } from "./types";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  // SECURITY: prefer the platform-set header; only used as one factor in the limiter key.
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function signIn(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return fail("Enter a valid email and password.");

  const ip = await clientIp();
  const limit = rateLimit(loginRateLimitKey(parsed.data.email, ip), 10, 15 * 60_000);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  // SECURITY: generic message — never reveal whether the email exists.
  if (error || !data.user) return fail("Invalid email or password.");

  // Resolve the landing page from OUR profiles table, not from JWT app_metadata
  // (which may be absent for provisioned users) and not from client input.
  const profile = await withIdentity(data.user.id, async (tx) => {
    const row = await tx.query.profiles.findFirst({
      where: eq(profiles.id, data.user.id),
      columns: { role: true, isActive: true },
    });
    return row;
  });

  if (!profile || !profile.isActive) {
    await supabase.auth.signOut();
    return fail("This account is disabled. Contact an administrator.");
  }

  return ok({ redirectTo: HOME_FOR_ROLE[profile.role] ?? "/pos" });
}

export async function signUp(raw: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const ip = await clientIp();
  const limit = rateLimit(`signup:${ip ?? "unknown"}`, 5, 60 * 60_000);
  if (!limit.ok) return fail("Too many sign-ups from this address. Try later.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // New users are ALWAYS cashiers. A DB trigger copies this into profiles.role.
    // Elevation is an explicit admin action, never user-controlled.
    options: { data: { full_name: parsed.data.fullName, role: "cashier" } },
  });

  if (error) return fail("Could not create the account. Please try again.");

  return ok({ needsConfirmation: !data.session });
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
