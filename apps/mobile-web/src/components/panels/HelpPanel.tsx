import type { JSX } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { getSettings } from "../../lib/settings";

export function HelpPanel(): JSX.Element {
  const [qrData, setQrData] = createSignal<string | null>(null);

  function generateQR(data: string): void {
    // Simple QR code using Google Charts API (no dependency needed)
    const encoded = encodeURIComponent(data);
    setQrData(
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`,
    );
  }

  onMount(() => {
    const s = getSettings();
    generateQR(s.serverUrl || "http://localhost:3000");
  });

  return (
    <div class="flex flex-col h-full panel-enter overflow-y-auto">
      <div class="flex items-center px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <span class="text-sm font-semibold text-slate-300">❓ Help</span>
      </div>

      <div class="px-4 py-4 space-y-5">
        {/* Connection Guide */}
        <div>
          <h3 class="text-sm font-medium text-slate-200 mb-2">
            🔗 Connecting to Your Server
          </h3>
          <ol class="text-sm text-slate-400 space-y-2 list-decimal list-inside">
            <li>
              Make sure the agent-workbench server is running:{" "}
              <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                cd apps/server && bun run dev
              </code>
            </li>
            <li>
              <strong>Same machine:</strong> Use{" "}
              <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                http://localhost:3000
              </code>
            </li>
            <li>
              <strong>Tailscale:</strong> Install Tailscale on both devices, use
              the server's Tailscale IP:{" "}
              <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                http://100.x.x.x:3000
              </code>
            </li>
            <li>
              <strong>LAN:</strong> Start server with{" "}
              <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                HOST=0.0.0.0
              </code>{" "}
              and use your machine's LAN IP
            </li>
            <li>
              <strong>ngrok:</strong> Run{" "}
              <code class="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                ngrok http 3000
              </code>{" "}
              and connect via the HTTPS URL
            </li>
          </ol>
        </div>

        {/* QR Code */}
        <div>
          <h3 class="text-sm font-medium text-slate-200 mb-2">
            📱 QR Code (Server URL)
          </h3>
          <p class="text-xs text-slate-500 mb-2">
            Scan with your phone's camera to quickly enter the server URL in
            Settings
          </p>
          {qrData() && (
            <img
              src={qrData()!}
              alt="Server URL QR Code"
              class="w-48 h-48 rounded-xl bg-white p-2"
            />
          )}
        </div>

        {/* About */}
        <div>
          <h3 class="text-sm font-medium text-slate-200 mb-2">ℹ️ About</h3>
          <table class="text-sm text-slate-400 w-full">
            <tbody>
              <tr class="border-b border-slate-800">
                <td class="py-1.5 pr-3 font-medium text-slate-500">App</td>
                <td class="py-1.5">agent-workbench mobile</td>
              </tr>
              <tr class="border-b border-slate-800">
                <td class="py-1.5 pr-3 font-medium text-slate-500">Version</td>
                <td class="py-1.5">0.0.0 (Phase 18)</td>
              </tr>
              <tr class="border-b border-slate-800">
                <td class="py-1.5 pr-3 font-medium text-slate-500">Stack</td>
                <td class="py-1.5">SolidJS + Tailwind CSS</td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 font-medium text-slate-500">Repo</td>
                <td class="py-1.5">
                  <a
                    href="https://github.com/MerverliPy/agent-workbench"
                    class="text-blue-400 active:text-blue-300"
                  >
                    github.com/MerverliPy/agent-workbench
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
