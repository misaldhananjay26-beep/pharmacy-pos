import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * GOTCHA: in-process state does not survive serverless cold starts and is per-instance.
 * It is adequate for local/dev and as a first line of defence. For production behind
 * multiple instances, swap the store for Upstash Redis (env vars already in .env.example).
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Build a limiter key from a trusted signal.
 * SECURITY: do NOT trust X-Forwarded-For on its own — it is client-spoofable. We combine
 * it with the submitted identity so an attacker must rotate both.
 */
export function loginRateLimitKey(email: string, ip: string | null): string {
  return `login:${email.toLowerCase()}:${ip ?? "unknown"}`;
}

// Housekeeping so the map cannot grow without bound.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
  }, 60_000).unref?.();
}
