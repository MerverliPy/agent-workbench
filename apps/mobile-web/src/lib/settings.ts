const SETTINGS_KEY = "agent-workbench-settings";

export interface ConnectionSettings {
  serverUrl: string;
  autoConnect: boolean;
  reconnectIntervalMs: number;
  preferredAgent: string;
}

const DEFAULTS: ConnectionSettings = {
  serverUrl: "http://localhost:3000",
  autoConnect: true,
  reconnectIntervalMs: 5000,
  preferredAgent: "build",
};

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
