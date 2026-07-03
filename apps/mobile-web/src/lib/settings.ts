const SETTINGS_KEY = "agent-workbench-settings";

export interface ConnectionSettings {
  serverUrl: string;
  autoConnect: boolean;
  reconnectIntervalMs: number;
  preferredAgent: string;
}

const DEFAULTS: ConnectionSettings = {
  serverUrl: getDefaultServerUrl(),
  autoConnect: true,
  reconnectIntervalMs: 5000,
  preferredAgent: "build",
};

/**
 * Auto-detect the server URL based on where the frontend was loaded from.
 * When accessed via Tailscale/network, use the same hostname as the page
 * so the iPhone connects to the WSL machine, not itself.
 */
function getDefaultServerUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
      return `http://${hostname}:3000`;
    }
  }
  return "http://localhost:3000";
}

export function getSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      serverUrl: parsed.serverUrl ?? DEFAULTS.serverUrl,
      autoConnect: parsed.autoConnect ?? DEFAULTS.autoConnect,
      reconnectIntervalMs:
        parsed.reconnectIntervalMs ?? DEFAULTS.reconnectIntervalMs,
      preferredAgent: parsed.preferredAgent ?? DEFAULTS.preferredAgent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(
  settings: Partial<ConnectionSettings>,
): ConnectionSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function resetSettings(): ConnectionSettings {
  localStorage.removeItem(SETTINGS_KEY);
  return { ...DEFAULTS };
}
