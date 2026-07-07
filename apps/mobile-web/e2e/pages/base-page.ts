import { type Page } from "@playwright/test";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = "/") {
    await this.page.goto(path);
    await this.page.waitForLoadState("load");
  }

  async captureConsoleErrors() {
    const errors: string[] = [];
    this.page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await this.page.evaluate((arr) => {
      (window as any).__consoleErrors = arr;
    }, errors);
  }

  async openDrawer() {
    await this.page.getByRole("button", { name: "Open menu" }).click();
    // "agent-workbench" appears in multiple places (topbar, help, etc).
    // Use .first() to avoid strict-mode violations.
    await this.page.getByText("agent-workbench").first().waitFor({ state: "visible" });
  }

  async navigateTo(panelName: string) {
    await this.openDrawer();
    await this.page.evaluate(
      (name) => {
        const btns = [...document.querySelectorAll("button")];
        btns.find((b) => b.textContent?.includes(name))?.click();
      },
      panelName,
    );
    await this.page.locator(`text=${panelName}`).first().waitFor({ state: "visible", timeout: 5000 });
  }

  /** Switch tabs via the bottom tab bar. Scoped by tablist name to avoid
   *  collisions with sub-navigation tabs. */
  async switchTab(tabName: string, tablistName = "Main navigation") {
    await this.page
      .getByRole("tablist", { name: tablistName })
      .getByRole("tab", { name: tabName, exact: true })
      .click();
    await this.page
      .getByRole("tablist", { name: tablistName })
      .getByRole("tab", { name: tabName, exact: true })
      .waitFor({ state: "visible" });
  }

  async getConsoleErrors(): Promise<string[]> {
    try {
      return await this.page.evaluate(() =>
        (window as any).__consoleErrors ?? [],
      );
    } catch {
      return [];
    }
  }
}
