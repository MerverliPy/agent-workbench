import { expect, test } from "@playwright/test";
import { setupMockServer, MOCK_RESPONSES } from "../utils/mock-server";

test.describe("Mock-driven states", () => {
  test("renders app shell when server healthy", async ({ page }) => {
    await setupMockServer(page, [
      { pattern: "**/global/health", body: MOCK_RESPONSES.healthOk },
    ]);
    await page.goto("/");
    // App shell should be visible regardless of server state
    await expect(page.getByRole("tab", { name: "Chats" })).toBeVisible({ timeout: 8000 });
  });

  test("renders app shell when server returns 500", async ({ page }) => {
    await setupMockServer(page, [
      { pattern: "**/global/health", status: 500, body: MOCK_RESPONSES.serverError },
    ]);
    await page.goto("/");
    // App shell should still render even when backend is broken
    await expect(page.getByRole("tab", { name: "Chats" })).toBeVisible({ timeout: 8000 });
    // Should have sent the textarea
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible({ timeout: 3000 });
  });

  test("renders app shell when server unreachable", async ({ page }) => {
    await page.route("**/global/health", (r) => r.abort("connectionrefused"));
    await page.goto("/");
    // App shell should still render
    await expect(page.getByRole("tab", { name: "Chats" })).toBeVisible({ timeout: 8000 });
  });
});
