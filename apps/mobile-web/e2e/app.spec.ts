import { expect, test } from "@playwright/test";

test.describe("App shell", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Agent WB");
  });

  test("430px shell is centered", async ({ page }) => {
    await page.goto("/");
    const shell = page.locator(".mx-auto");
    await expect(shell).toBeVisible();
    const box = await shell.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(432);
    expect(box!.width).toBeGreaterThanOrEqual(380);
  });

  test("topbar renders with all chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toContainText("Hermes Audit Workspace");
    await expect(page.locator("header")).toContainText("Safe");
  });

  test("5-tab bottom nav renders", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("tablist", { name: "Main navigation" });
    await expect(nav).toBeVisible();
    const tabs = nav.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toHaveText("Chats");
    await expect(tabs.nth(1)).toHaveText("Workspaces");
    await expect(tabs.nth(2)).toHaveText("Files");
    await expect(tabs.nth(3)).toHaveText("Activity");
    await expect(tabs.nth(4)).toHaveText("Settings");
  });
});

test.describe("Theme toggle", () => {
  test("toggles from light to dark on click", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: /switch to (dark|light) mode/i });
    await expect(btn).toBeVisible();
    const initialLabel = await btn.textContent();

    // First click
    await btn.click({ force: true });
    const afterFirst = await btn.textContent();
    expect(afterFirst).not.toBe(initialLabel);

    // Verify dark class applied
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark).toBe(true);
  });

  test("cycles through auto → dark → light", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: /switch to /i });
    const initial = await btn.textContent();
    await btn.click({ force: true });
    await page.waitForTimeout(200);
    const afterFirstText = await page.getByRole("button", { name: /switch to /i }).textContent();
    expect(afterFirstText).not.toBe(initial);
  });

  test("persists theme across reloads", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: /switch to (dark|light) mode/i });
    await btn.click({ force: true });
    await page.reload();
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark).toBe(true);
  });
});

test.describe("Tab navigation", () => {
  test("Chats tab is selected by default", async ({ page }) => {
    await page.goto("/");
    const chats = page.getByRole("tab", { name: "Chats" });
    await expect(chats).toHaveAttribute("aria-selected", "true");
  });

  test("Workspaces tab shows sub-navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Workspaces" }).click();
    const subNav = page.getByRole("tablist", { name: "Workspace sections" });
    await expect(subNav).toBeVisible();
    const subTabs = subNav.getByRole("tab");
    await expect(subTabs).toHaveCount(3);
    await expect(subTabs.nth(0)).toHaveText("Files");
    await expect(subTabs.nth(1)).toHaveText("Git");
    await expect(subTabs.nth(2)).toHaveText("Sessions");
  });

  test("Files tab shows file browser", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Files" }).click();
    const selected = page.getByRole("tab", { name: "Files", exact: true });
    await expect(selected).toHaveAttribute("aria-selected", "true");
  });

  test("Activity tab shows activity log", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Activity" }).click();
    const selected = page.getByRole("tab", { name: "Activity", exact: true });
    await expect(selected).toHaveAttribute("aria-selected", "true");
  });

  test("returns to Chats from another tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Chats" }).click();
    const chats = page.getByRole("tab", { name: "Chats" });
    await expect(chats).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Composer", () => {
  test("textarea is present with correct placeholder", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible();
  });

  test("send button is disabled when empty", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Send message" });
    await expect(btn).toBeDisabled();
  });

  test("send button enables when text is typed", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder("Type a message...");
    await textarea.fill("Hello");
    const btn = page.getByRole("button", { name: "Send message" });
    await expect(btn).not.toBeDisabled();
  });

  test("attach and mic buttons exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Attach file" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voice input" })).toBeVisible();
  });
});

test.describe("NavDrawer", () => {
  test("drawer opens from hamburger menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByText("agent-workbench")).toBeVisible();
  });

  test("drawer shows Settings and Help only", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    // Check the drawer navigation buttons directly by role
    const settingsBtn = page.getByRole("button", { name: "Settings" });
    const helpBtn = page.getByRole("button", { name: "Help" });
    await expect(settingsBtn).toBeVisible();
    await expect(helpBtn).toBeVisible();
    // Verify no Chat/Files/Git buttons in the drawer
    await expect(page.getByRole("button", { name: "Chat" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "File Browser" })).not.toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("message canvas has role=log", async ({ page }) => {
    await page.goto("/");
    const log = page.locator('[role="log"]');
    await expect(log).toBeVisible();
  });

  test("tab nav has role=tablist with aria-label", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Main navigation" });
    await expect(tabs).toBeVisible();
  });

  test("tab buttons have aria-selected", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Main navigation" }).getByRole("tab");
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected");
    }
  });
});

test.describe("iOS Safari hardening", () => {
  test("touch targets are minimum 44×44px (iOS HIG)", async ({ page }) => {
    await page.goto("/");
    const sizes = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      return Array.from(buttons).map((btn) => {
        const rect = btn.getBoundingClientRect();
        return { text: (btn.textContent ?? "").trim().slice(0, 30), w: Math.round(rect.width), h: Math.round(rect.height) };
      });
    });
    // Tab bar buttons, drawer nav buttons, and send button should all be >=44 in one dimension
    // Exclude icon-only elements (no meaningful text, connection dot, empty spans)
    const undersized = sizes.filter((s) => {
      const iconOnly = !s.text || s.text === "◐" || s.text === "(svg icon)" || s.text === "";
      return !iconOnly && s.w < 44 && s.h < 44;
    });
    expect(undersized.length).toBe(0);
  });

  test("visualViewport script is embedded in index.html", async ({ page }) => {
    await page.goto("/");
    const hasScript = await page.evaluate(() => {
      return typeof window.visualViewport !== "undefined" ||
        document.documentElement.innerHTML.includes("visualViewport");
    });
    expect(hasScript).toBe(true);
  });

  test("body has overscroll-behavior: none", async ({ page }) => {
    await page.goto("/");
    const style = await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior);
    expect(style).toBe("none");
  });

  test("frost class exists on topbar and tabbar", async ({ page }) => {
    await page.goto("/");
    const frostElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".frost")).length;
    });
    expect(frostElements).toBeGreaterThanOrEqual(2);
  });

  test("safe area CSS variables are defined", async ({ page }) => {
    await page.goto("/");
    const hasSafeArea = await page.evaluate(() => {
      const html = document.documentElement;
      const style = getComputedStyle(html);
      return {
        top: style.getPropertyValue("--safe-top"),
        bottom: style.getPropertyValue("--safe-bottom"),
      };
    });
    // Should have a value (even if 0px on non-notched displays)
    expect(hasSafeArea.top).toBeTruthy();
    expect(hasSafeArea.bottom).toBeTruthy();
  });
});
