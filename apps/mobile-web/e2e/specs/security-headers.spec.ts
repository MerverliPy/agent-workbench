import { expect, test } from "@playwright/test";

test.describe("Security headers", () => {
  const SERVER_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3000";

  test("returns x-content-type-options: nosniff", async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/global/health`);
    const value = response.headers()["x-content-type-options"];
    expect(value).toBe("nosniff");
  });

  test("returns x-frame-options: DENY", async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/global/health`);
    const value = response.headers()["x-frame-options"];
    expect(value).toBe("DENY");
  });

  test("returns referrer-policy header", async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/global/health`);
    const value = response.headers()["referrer-policy"];
    expect(value).toBeDefined();
  });

  test("returns content-security-policy header", async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/global/health`);
    const value = response.headers()["content-security-policy"];
    expect(value).toBeDefined();
  });
});
