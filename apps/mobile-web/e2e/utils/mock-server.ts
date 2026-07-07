import type { Page } from "@playwright/test";

export interface MockRoute {
  pattern: string | RegExp;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

export async function setupMockServer(page: Page, routes: MockRoute[]) {
  for (const route of routes) {
    await page.route(route.pattern, async (apiRoute) => {
      if (route.method && apiRoute.request().method() !== route.method) {
        await apiRoute.fallback();
        return;
      }
      await apiRoute.fulfill({
        status: route.status ?? 200,
        headers: { "Content-Type": "application/json", ...route.headers },
        body: JSON.stringify(route.body),
      });
    });
  }
}

export const MOCK_RESPONSES = {
  healthOk: { status: "ok", version: "0.0.0-test", uptime: 12345 },
  emptySessions: { items: [] },
  serverError: { error: "Internal Server Error", code: "INTERNAL_ERROR" },
};
