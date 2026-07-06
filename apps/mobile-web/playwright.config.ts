import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 15000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5175",
    actionTimeout: 5000,
  },
  projects: [
    {
      name: "iPhone 14",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "iPhone 16 Pro",
      use: {
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        defaultBrowserType: "chromium",
      },
    },
  ],
  webServer: {
    command: "~/.bun/bin/bun run dev --port 5175",
    port: 5175,
    reuseExistingServer: !process.env.CI,
    cwd: ".",
  },
});
