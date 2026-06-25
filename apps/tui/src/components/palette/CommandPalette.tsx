import type { JSX } from "@opentui/solid";
import { For } from "solid-js";
import { setCommandPaletteOpen, appendSystemNotice } from "../../state/app";
import { sdk } from "../../lib/sdk";
import { ApiError } from "@agent-workbench/sdk";

interface PaletteCommand {
  readonly name: string;
  readonly description: string;
  readonly action: () => void | Promise<void>;
}

/**
 * Command palette overlay.
 *
 * Opened with Ctrl+P; dismissed with Escape or selecting a command.
 *
 * Phase 4 commands:
 *   /help      — show usage notice in timeline
 *   /health    — ping server health endpoint
 *   /info      — fetch server info
 *   /sessions  — placeholder (server returns 501)
 *   /abort     — placeholder (server returns 501)
 *   /clear     — clear local message timeline
 *   /close     — close this palette
 *
 * Commands must NOT execute shell, mutate files, call models, or bypass SDK.
 */
export function CommandPalette(): JSX.Element {
  function close(): void {
    setCommandPaletteOpen(false);
  }

  const commands: PaletteCommand[] = [
    {
      name: "/help",
      description: "Show usage information",
      action: () => {
        appendSystemNotice(
          "agent-workbench Phase 4 TUI  |  Ctrl+Enter=submit  Ctrl+P=palette  Ctrl+C=exit  |  " +
            "Server must be running at http://localhost:3000",
        );
        close();
      },
    },
    {
      name: "/health",
      description: "Check server health",
      action: async () => {
        try {
          const result = await sdk.health.check();
          appendSystemNotice(
            `Server health: ${result.status}  uptime: ${Math.round(result.uptime)}s`,
          );
        } catch (err) {
          appendSystemNotice(
            `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/info",
      description: "Fetch server info",
      action: async () => {
        try {
          const info = await sdk.health.getInfo();
          appendSystemNotice(`Server info: ${info.name ?? "agent-workbench"}  v${info.version}`);
        } catch (err) {
          appendSystemNotice(
            `Info fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/sessions",
      description: "List sessions (Phase 5 placeholder)",
      action: async () => {
        try {
          await sdk.sessions.list();
          appendSystemNotice("Sessions: (empty)");
        } catch (err) {
          if (err instanceof ApiError && err.status === 501) {
            appendSystemNotice("Sessions not available yet — server placeholder (Phase 5).");
          } else {
            appendSystemNotice(
              `Sessions error: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        close();
      },
    },
    {
      name: "/abort",
      description: "Abort active run (Phase 6 placeholder)",
      action: () => {
        appendSystemNotice("Abort: no active run — core runtime is a Phase 6 feature.");
        close();
      },
    },
    {
      name: "/clear",
      description: "Clear message timeline (local only)",
      action: () => {
        // Import setMessages lazily to avoid circular import
        import("../../state/app").then(({ setMessages }) => {
          setMessages([]);
        });
        close();
      },
    },
    {
      name: "/close",
      description: "Close command palette",
      action: () => close(),
    },
  ];

  return (
    <box
      position="absolute"
      top={2}
      left={4}
      width={60}
      height={commands.length + 4}
      border={true}
      title=" Command Palette  [Ctrl+P to close] "
      titleAlignment="center"
      zIndex={10}
      flexDirection="column"
      padding={1}
    >
      <For each={commands}>
        {(cmd) => (
          <box
            height={1}
            flexDirection="row"
            flexShrink={0}
            onMouseDown={() => {
              void cmd.action();
            }}
          >
            <text content={`  ${cmd.name.padEnd(14)}  ${cmd.description}`} flexGrow={1} />
          </box>
        )}
      </For>
    </box>
  );
}
