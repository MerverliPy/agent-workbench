import { expect, test } from "@playwright/test";
import { SettingsPage } from "../pages/settings-page";

test.describe("Settings panel", () => {
  test("server URL input is visible", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto("/");
    await settings.navigateTo("Settings");
    await expect(settings.serverUrlInput).toBeVisible({ timeout: 5000 });
  });

  test("auto-connect toggle exists", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto("/");
    await settings.navigateTo("Settings");
    await expect(settings.autoConnectButton).toBeVisible();
  });

  test("persists settings on save", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto("/");
    await settings.navigateTo("Settings");
    await settings.setServerUrl("http://192.168.1.100:3000");
    await settings.save();
    const stored = await settings.getPersistedSettings();
    expect(stored.serverUrl).toBe("http://192.168.1.100:3000");
  });

  test("Save Settings and Reset to Defaults buttons exist", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto("/");
    await settings.navigateTo("Settings");
    await expect(settings.saveButton).toBeVisible();
    await expect(settings.resetButton).toBeVisible();
  });

  test("Test Connection button exists", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto("/");
    await settings.navigateTo("Settings");
    await expect(settings.testConnectionButton).toBeVisible();
  });
});
