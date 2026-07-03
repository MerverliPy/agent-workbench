import type { Context } from "hono";
import type { ServerAppBindings } from "../context";

/**
 * Rate-limit middleware for agent-workbench server.
 *
 * Uses a simple per-IP token bucket with configurable limits.
 * When a user is authenticated (bearer token), rate limits by user ID
 * instead of IP, with a higher default limit.
 *
 * Default per-IP: 60 req/min. Default per-user: 300 req/min.
 * Override via AGENT_WORKBENCH_RATE_LIMIT (applies to both).
 */
export function rateLimitMiddleware() {
  const LIMIT = Number(process.env.AGENT_WORKBENCH_RATE_LIMIT) || 60;
  const USER_LIMIT = Number(process.env.AGENT_WORKBENCH_USER_RATE_LIMIT) || 300;
  const WINDOW_MS = 60_000;
  const buckets = new Map<string, { tokens: number; resetAt: number }>();

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt + WINDOW_MS) buckets.delete(key);
    }
  }, 300_000).unref();

  return async (ctx: Context<ServerAppBindings>, next: () => Promise<void>) => {
    const ip =
      ctx.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      ctx.req.header("x-real-ip") ||
      "127.0.0.1";

    // Use authenticated user key when available (higher limit), else IP
    const auth = ctx.get("auth" as never) as
      | { authenticated: boolean; subject?: string }
      | undefined;
    const isAuthenticated = auth?.authenticated === true && auth.subject;
    const key = isAuthenticated ? `user:${auth?.subject}` : `ip:${ip}`;
    const limit = isAuthenticated ? USER_LIMIT : LIMIT;

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { tokens: limit, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }

    if (bucket.tokens <= 0) {
      ctx.header(
        "Retry-After",
        String(Math.ceil((bucket.resetAt - now) / 1000)),
      );
      return ctx.json(
        {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          recoverable: true,
        },
        429,
      );
    }

    bucket.tokens--;
    ctx.header("X-RateLimit-Remaining", String(bucket.tokens));
    ctx.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    await next();
  };
}
