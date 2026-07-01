import { WorkbenchClient } from "@agent-workbench/sdk";
import { getSettings } from "./settings";

let _client: WorkbenchClient | null = null;

export function getClient(): WorkbenchClient {
  if (!_client) {
    const settings = getSettings();
    _client = new WorkbenchClient({ baseUrl: settings.serverUrl });
  }
  return _client;
}

export function reconnectClient(serverUrl: string): WorkbenchClient {
  _client = new WorkbenchClient({ baseUrl: serverUrl });
  return _client;
}
