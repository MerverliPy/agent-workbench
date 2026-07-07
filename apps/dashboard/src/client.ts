import type { DashboardResponse } from "@agent-workbench/protocol";
import { WorkbenchClient } from "@agent-workbench/sdk";

export type { DashboardResponse };

/**
 * Lightweight client for the agent-workbench observability dashboard.
 * Uses the typed SDK for server connectivity.
 */
export class DashboardClient {
  private client: WorkbenchClient;
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.client = new WorkbenchClient({ baseUrl: this.baseUrl });
  }

  async fetchDashboard(): Promise<DashboardResponse> {
    return this.client.observability.getDashboard();
  }

  getServerUrl(): string {
    return this.baseUrl;
  }

  /** Update the server URL and recreate the client connection. */
  setServerUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, "");
    this.client = new WorkbenchClient({ baseUrl: this.baseUrl });
  }
}
