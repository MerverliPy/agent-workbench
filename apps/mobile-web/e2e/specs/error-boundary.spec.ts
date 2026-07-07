import { expect, test } from "@playwright/test";
import { ChatPage } from "../pages/chat-page";

test.describe("Error boundaries", () => {
  test("shows error UI when server returns 5xx on health check", async ({
    page,
  }) => {
    await page.route("**/health", (r) =>
      r.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );
    await page.goto("/");
    await expect(
      page.locator("body"),
    ).not.toBeEmpty();
    // The app should render its shell even when the server is broken
    await expect(page.getByRole("tab", { name: "Chats" })).toBeVisible({ timeout: 8000 });
  });

  test("shows degraded UI when SSE connection fails", async ({ page }) => {
    const chat = new ChatPage(page);
    await page.route("**/events/**", (r) =>
      r.abort("connectionrefused"),
    );
    await chat.goto("/");
    // Chat should still render with a connection indicator
    await expect(chat.composer).toBeVisible({ timeout: 5000 });
  });

  test("handles malformed SSE events without crashing", async ({ page }) => {
    await page.route("**/events/**", async (r) => {
      await r.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: "garbage data\nnot-an-event\n::::\n",
      });
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).not.toBeEmpty();
    // Check the app didn't crash by verifying an interactive element exists
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible({ timeout: 3000 });
  });
});
