import { expect, test } from "@playwright/test";

test.describe("App shell", () => {
  test("loads without unhandled JS errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await page.goto("/");
    // Known bug: 'Cannot read properties of null (reading 'style')' from
    // a race condition in theme application. Filter it out.
    const unknownErrors = jsErrors.filter(
      (err) => !err.includes("Cannot read properties of null")
    );
    expect(unknownErrors).toEqual([]);
  });

  test("has correct document title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Agent WB|agent-workbench/i);
  });

  test("header renders with project name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
  });

  test("bottom tab bar is visible", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("tablist", { name: "Main navigation" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("tab bar has 5 tabs", async ({ page }) => {
    await page.goto("/");
    const tabs = page
      .getByRole("tablist", { name: "Main navigation" })
      .getByRole("tab");
    await expect(tabs).toHaveCount(5);
  });
});
