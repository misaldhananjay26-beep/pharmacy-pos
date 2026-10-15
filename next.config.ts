import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Reason: Next's dev server (Fast Refresh / react-refresh-utils) compiles modules with
// `eval`, and the HMR client opens a WebSocket. Both must be allowed in development or
// hydration silently fails (and a native form submit could leak the password into the URL).
// Production keeps the stricter policy: no 'unsafe-eval', no ws:.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const connectSrc = isDev
  ? "connect-src 'self' ws: wss: https://*.supabase.co"
  : "connect-src 'self' https://*.supabase.co";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next's inline bootstrap; tighten with nonces before launch.
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  connectSrc,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Reason: this project sits inside a parent folder that has its own package-lock.json
  // (an unrelated app). Pin the tracing root so Next does not infer the wrong workspace.
  outputFileTracingRoot: process.cwd(),
  // SECURITY: never ship readable source maps to production.
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
