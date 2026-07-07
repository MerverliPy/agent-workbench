import { expect, test } from "@playwright/test";
import { BasePage } from "../pages/base-page";

test.describe("Navigation", () => {
  test("Chats tab is selected by default", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    const chatsTab = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab", { name: "Chats" });
    await expect(chatsTab).toHaveAttribute("aria-selected", "true");
  });

  test("each tab button has aria-selected attribute", async ({ page }) => {
    await page.goto("/");
    const tabs = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab");
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected");
    }
  });

  test("switches to Files tab on click", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    await bp.switchTab("Files");
    const filesTab = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab", { name: "Files", exact: true });
    await expect(filesTab).toHaveAttribute("aria-selected", "true");
  });

  test("switches to Settings tab on click", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    await bp.switchTab("Settings");
    const settingsTab = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab", { name: "Settings", exact: true });
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
  });

  test("returns to Chats from Settings", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    await bp.switchTab("Settings");
    await bp.switchTab("Chats");
    const chatsTab = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab", { name: "Chats" });
    await expect(chatsTab).toHaveAttribute("aria-selected", "true");
  });

  test("drawer opens from hamburger menu", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    await bp.openDrawer();
    await expect(page.getByText("agent-workbench")).toBeVisible();
  });

  test("drawer contains Settings and Help buttons", async ({ page }) => {
    const bp = new BasePage(page);
    await bp.goto("/");
    await bp.openDrawer();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  });
});
