import { type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export class ChatPage extends BasePage {
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly messageLog: Locator;
  readonly attachButton: Locator;
  readonly voiceButton: Locator;

  constructor(page: Page) {
    super(page);
    this.composer = page.getByPlaceholder("Type a message...");
    this.sendButton = page.getByRole("button", { name: "Send message" });
    this.messageLog = page.locator('[role="log"]');
    this.attachButton = page.getByRole("button", { name: "Attach file" });
    this.voiceButton = page.getByRole("button", { name: "Voice input" });
  }

  async sendMessage(text: string) {
    await this.composer.fill(text);
    await this.sendButton.click();
  }

  async waitForAssistantResponse(timeout = 15000) {
    await this.page.waitForFunction(
      () => {
        const log = document.querySelector('[role="log"]');
        if (!log) return false;
        const messages = log.querySelectorAll("[data-role]");
        return (
          Array.from(messages).filter(
            (m) => m.getAttribute("data-role") === "assistant",
          ).length > 0
        );
      },
      { timeout },
    );
  }

  async getMessages(): Promise<Array<{ role: string; content: string }>> {
    return this.page.evaluate(() => {
      const log = document.querySelector('[role="log"]');
      if (!log) return [];
      return Array.from(log.querySelectorAll("[data-role]")).map((el) => ({
        role: el.getAttribute("data-role") ?? "unknown",
        content: el.textContent ?? "",
      }));
    });
  }
}
