import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { complianceHeaders } from "./compliance-headers";

function createTestApp(config?: Parameters<typeof complianceHeaders>[0]) {
  const app = new Hono();
  app.use("*", complianceHeaders(config));
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}

describe("compliance-headers middleware", () => {
  it("sets X-Content-Type-Options: nosniff", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options: DENY", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("sets Permissions-Policy", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    const pp = res.headers.get("Permissions-Policy");
    expect(pp).toBeTruthy();
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
  });

  it("sets Content-Security-Policy with sensible defaults", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("does not set HSTS when not HTTPS", async () => {
    const app = createTestApp({ isHttps: false });
    const res = await app.request("/health");
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("sets HSTS when HTTPS is enabled", async () => {
    const app = createTestApp({ isHttps: true });
    const res = await app.request("/health");
    const hsts = res.headers.get("Strict-Transport-Security");
    expect(hsts).toBeTruthy();
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
  });

  it("skips CSP on exempt paths", async () => {
    const app = createTestApp({ cspExemptPaths: ["/sse"] });
    app.get("/sse", (c) => c.text("event stream"));
    const res = await app.request("/sse");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("supports report-only mode", async () => {
    const app = createTestApp({ mode: "report-only" });
    const res = await app.request("/health");
    expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeTruthy();
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("supports disabled mode", async () => {
    const app = createTestApp({ mode: "disabled" });
    const res = await app.request("/health");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("includes extra custom headers", async () => {
    const app = createTestApp({
      extraHeaders: { "X-Custom": "value", "X-Trace": "abc123" },
    });
    const res = await app.request("/health");
    expect(res.headers.get("X-Custom")).toBe("value");
    expect(res.headers.get("X-Trace")).toBe("abc123");
  });

  it("extends connect-src with extra origins", async () => {
    const app = createTestApp({
      extraConnectSrc: ["https://api.example.com"],
    });
    const res = await app.request("/health");
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("https://api.example.com");
  });

  it("does not block normal responses", async () => {
    const app = createTestApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
