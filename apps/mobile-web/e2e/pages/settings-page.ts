import { type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export class SettingsPage extends BasePage {
  readonly serverUrlInput: Locator;
  readonly autoConnectButton: Locator;
  readonly saveButton: Locator;
  readonly resetButton: Locator;
  readonly testConnectionButton: Locator;

  constructor(page: Page) {
    super(page);
    // The <label>Server URL</label> is not associated with <input> via for/id
    // or nesting. Use placeholder text instead for reliable targeting.
    this.serverUrlInput = page.getByPlaceholder("http://192.168.1.50:3000");
    // Auto-connect toggle: find the "Auto-connect" text, navigate up to the
    // flex container, then find the textless button inside it.
    this.autoConnectButton = page
      .locator("div.flex.items-center.justify-between", {
        has: page.locator("span", { hasText: "Auto-connect" }),
      })
      .locator("button:not(:has(span))")
      .first();
    this.saveButton = page.getByRole("button", { name: "Save Settings" });
    this.resetButton = page.getByRole("button", { name: "Reset to Defaults" });
    this.testConnectionButton = page.getByRole("button", { name: "Test Connection" });
  }

  async setServerUrl(url: string) {
    await this.serverUrlInput.fill(url);
  }

  async save() {
    await this.saveButton.click();
    await this.page.waitForFunction(
      () => {
        const raw = localStorage.getItem("agent-workbench-settings");
        return raw !== null;
      },
      { timeout: 3000 },
    );
  }

  async getPersistedSettings(): Promise<Record<string, unknown>> {
    return this.page.evaluate(() => {
      const raw = localStorage.getItem("agent-workbench-settings");
      return raw ? JSON.parse(raw) : {};
    });
  }

  async toggleAutoConnect() {
    await this.autoConnectButton.click();
  }
}
