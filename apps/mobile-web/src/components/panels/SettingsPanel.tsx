import type { JSX } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { reconnectClient } from "../../lib/sdk";
import { getSettings, resetSettings, saveSettings } from "../../lib/settings";
import { setCurrentAgentId } from "../../state/app";

type Theme = "dark" | "light" | "system";

const THEME_KEY = "agent-workbench-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "system")
      return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");

  if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function SettingsPanel(): JSX.Element {
  const [serverUrl, setServerUrl] = createSignal(getSettings().serverUrl);
  const [autoConnect, setAutoConnect] = createSignal(getSettings().autoConnect);
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<string | null>(null);
  const [agent, setAgent] = createSignal(getSettings().preferredAgent);
  const [theme, setTheme] = createSignal<Theme>(getStoredTheme());

  function handleSave(): void {
    saveSettings({
      serverUrl: serverUrl(),
      autoConnect: autoConnect(),
      preferredAgent: agent(),
    });
    setCurrentAgentId(agent());
    reconnectClient(serverUrl());
    setTestResult("✓ Settings saved");
  }

  function handleReset(): void {
    const defaults = resetSettings();
    setServerUrl(defaults.serverUrl);
    setAutoConnect(defaults.autoConnect);
    setAgent(defaults.preferredAgent);
    applyTheme("dark");
    setTheme("dark");
    setTestResult("Settings reset to defaults");
  }

  async function testConnection(): Promise<void> {
    setTesting(true);
    setTestResult(null);

    // Persist settings BEFORE testing so the main app sees the same URL.
    const saved = saveSettings({
      serverUrl: serverUrl(),
      autoConnect: autoConnect(),
      preferredAgent: agent(),
    });

    try {
      const client = reconnectClient(saved.serverUrl);
      await client.health.check();
      setTestResult("✓ Connected successfully");
    } catch (err) {
      setTestResult(
        `✕ ${err instanceof Error ? err.message : "Connection failed"}`,
      );
    } finally {
      setTesting(false);
    }
  }

  function handleThemeChange(newTheme: Theme): void {
    applyTheme(newTheme);
    setTheme(newTheme);
  }

  onMount(() => {
    const s = getSettings();
    setServerUrl(s.serverUrl);
    setAutoConnect(s.autoConnect);
    setAgent(s.preferredAgent);
    setTheme(getStoredTheme());
  });

  return (
    <div class="flex flex-col h-full panel-enter">
      <div class="flex items-center px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span class="text-sm font-semibold text-slate-300">⚙️ Settings</span>
      </div>

      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Server URL */}
        <div>
          <label class="text-xs text-slate-400 block mb-1.5">Server URL</label>
          <input
            type="text"
            class="w-full bg-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
            value={serverUrl()}
            onInput={(e) => setServerUrl((e.target as HTMLInputElement).value)}
            placeholder="http://192.168.1.50:3000"
          />
          <div class="flex gap-2 mt-2">
            <button
              class="flex-1 text-xs bg-slate-700 text-slate-300 py-1.5 rounded-lg active:bg-slate-600 disabled:opacity-50"
              onClick={testConnection}
              disabled={testing()}
            >
              {testing() ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {testResult() && (
            <p
              class={`text-xs mt-1.5 ${testResult()?.startsWith("✓") ? "text-green-400" : "text-red-400"}`}
            >
              {testResult()}
            </p>
          )}
        </div>

        {/* Theme */}
        <div>
          <label class="text-xs text-slate-400 block mb-1.5">Theme</label>
          <div class="flex gap-2">
            {(["dark", "light", "system"] as Theme[]).map((t) => (
              <button
                class={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                  theme() === t
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
                onClick={() => handleThemeChange(t)}
              >
                {t === "dark"
                  ? "🌙 Dark"
                  : t === "light"
                    ? "☀️ Light"
                    : "💻 System"}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-connect */}
        <div class="flex items-center justify-between">
          <div>
            <span class="text-sm text-slate-200 block">Auto-connect</span>
            <span class="text-xs text-slate-500">Reconnect on app open</span>
          </div>
          <button
            class={`w-12 h-7 rounded-full transition-colors ${
              autoConnect() ? "bg-blue-600" : "bg-slate-700"
            }`}
            onClick={() => setAutoConnect(!autoConnect())}
          >
            <div
              class={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                autoConnect() ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Agent */}
        <div>
          <label class="text-xs text-slate-400 block mb-1.5">
            Default Agent
          </label>
          <div class="flex gap-2">
            <button
              class={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                agent() === "build"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
              onClick={() => setAgent("build")}
            >
              Build
            </button>
            <button
              class={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                agent() === "plan"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
              onClick={() => setAgent("plan")}
            >
              Plan
            </button>
          </div>
        </div>

        {/* Actions */}
        <div class="space-y-2 pt-2">
          <button
            class="w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-xl active:bg-blue-700 transition-colors min-h-[44px]"
            onClick={handleSave}
          >
            Save Settings
          </button>
          <button
            class="w-full py-3 bg-slate-700 text-slate-400 text-sm rounded-xl active:bg-slate-600 transition-colors min-h-[44px]"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
