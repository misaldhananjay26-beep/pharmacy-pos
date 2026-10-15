"use server";

/**
 * Shared result envelope for every Server Action — never throws at the client, never leaks internals.
 * NOTE: this file is a "use server" module. Next.js requires every exported binding to
 * be an async function; ok/fail are now async helpers.
 * Failure carries a short, user-safe `error` string; details are logged server-side.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = async <T>(data: T): Promise<ActionResult<T>> => ({ ok: true, data });
export const fail = async (error: string): Promise<ActionResult<never>> => ({ ok: false, error });
