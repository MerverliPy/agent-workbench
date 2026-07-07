import { expect, test } from "@playwright/test";
import { ChatPage } from "../pages/chat-page";

test.describe("Chat panel", () => {
  test("textarea is present with placeholder", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto("/");
    await expect(chat.composer).toBeVisible();
  });

  test("send button is disabled when empty", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto("/");
    await expect(chat.sendButton).toBeDisabled();
  });

  test("send button enables when text is typed", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto("/");
    await chat.composer.fill("Hello");
    await expect(chat.sendButton).not.toBeDisabled();
  });

  test("attach and voice buttons exist", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto("/");
    await expect(chat.attachButton).toBeVisible();
    await expect(chat.voiceButton).toBeVisible();
  });

  test("message log has role=log", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto("/");
    const log = page.locator('[role="log"]');
    await expect(log).toBeVisible();
  });
});
