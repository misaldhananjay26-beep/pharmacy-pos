import "server-only";

import { redirect } from "next/navigation";

import type { AppUser } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";

/**
 * THE authorization boundary. Every Server Action that reads or writes protected data
 * must call this first. Throws (rather than silently returning) so a missing guard is loud.
 */
export async function requireRole(allowed: Role[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  if (!allowed.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** For Server Components / pages: redirects instead of throwing. */
export async function requirePageRole(allowed: Role[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect("/no-access");
  return user;
}

/** Convert a guard error into a user-safe message. Never leaks internals. */
export function guardErrorToMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "UNAUTHENTICATED") return "Please sign in again.";
  if (msg === "FORBIDDEN") return "You do not have access to this action.";
  return "Something went wrong. Please try again.";
}
