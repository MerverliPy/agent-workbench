import type { Context } from "hono";
import type { ServerAppBindings } from "../context";

/**
 * Rate-limit middleware for agent-workbench server.
 * 
 * Uses a simple per-IP token bucket with configurable limits.
 * Default: 60 requests per minute per IP.
 */
export function rateLimitMiddleware() {
  const LIMIT = Number(process.env["AGENT_WORKBENCH_RATE_LIMIT"]) || 60;
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

    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { tokens: LIMIT, resetAt: now + WINDOW_MS };
      buckets.set(ip, bucket);
    }

    if (bucket.tokens <= 0) {
      ctx.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return ctx.json(
        { code: "RATE_LIMITED", message: "Too many requests. Please try again later.", recoverable: true },
        429,
      );
    }

    bucket.tokens--;
    ctx.header("X-RateLimit-Remaining", String(bucket.tokens));
    ctx.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    await next();
  };
}
