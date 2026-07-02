import type { JSX } from "@opentui/solid";
import { For, createSignal, createMemo, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { setCommandPaletteOpen, appendSystemNotice, setMessages } from "../../state/app";
import { sdk } from "../../lib/sdk";
import { formatKeybindings } from "../../lib/keybindings";
import { ApiError } from "@agent-workbench/sdk";

interface PaletteCommand {
  readonly name: string;
  readonly description: string;
  readonly keywords: string;
  readonly action: () => void | Promise<void>;
}

/**
 * Simple fuzzy match — returns true if all query chars appear in order
 * in the target string.
 */
function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const lowerQ = query.toLowerCase();
  const lowerT = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lowerT.length && qi < lowerQ.length; ti++) {
    if (lowerT[ti] === lowerQ[qi]) qi++;
  }
  return qi === lowerQ.length;
}

/**
 * Command palette with fuzzy search.
 *
 * Opened with Ctrl+K or Ctrl+P; dismissed with Escape.
 * Type characters to fuzzy-filter commands by name, description, or keywords.
 * Backspace removes last char; Enter triggers first visible command.
 */
export function CommandPalette(): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  function close(): void {
    setCommandPaletteOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }

  function executeCommand(cmd: PaletteCommand): void {
    setCommandPaletteOpen(false);
    setQuery("");
    setSelectedIndex(0);
    void cmd.action();
  }

  // ── Keyboard handling for search input ─────────────────────────────

  useKeyboard((key) => {
    if (key.name === "escape") {
      close();
      return;
    }

    if (key.name === "return") {
      const cmds = filtered();
      const idx = selectedIndex();
      if (cmds.length > 0 && idx < cmds.length) {
        executeCommand(cmds[idx]!);
      }
      return;
    }

    if (key.name === "backspace") {
      setQuery((q) => q.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    // Arrow keys for navigation
    if (key.name === "down") {
      setSelectedIndex((i) => Math.min(i + 1, filtered().length - 1));
      return;
    }
    if (key.name === "up") {
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }

    // Printable characters: append to query
    if (key.name.length === 1 && !key.ctrl && !key.meta) {
      setQuery((q) => q + key.name);
      setSelectedIndex(0);
      return;
    }
  });

  // ── Commands ───────────────────────────────────────────────────────

  const staticCommands: PaletteCommand[] = [
    {
      name: "/help",
      description: "Show keyboard shortcuts",
      keywords: "shortcuts keys bindings reference",
      action: () => {
        appendSystemNotice(formatKeybindings());
        close();
      },
    },
    {
      name: "/health",
      description: "Check server health",
      keywords: "ping status uptime server",
      action: async () => {
        try {
          const r = await sdk.health.check();
          appendSystemNotice(
            `Health: ${r.status}  uptime: ${Math.round(r.uptime)}s`,
          );
        } catch (err) {
          appendSystemNotice(
            `Health failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/info",
      description: "Fetch server info (version, uptime)",
      keywords: "version about server info",
      action: async () => {
        try {
          const info = await sdk.health.getInfo();
          appendSystemNotice(
            `${info.name ?? "agent-workbench"} v${info.version}  up: ${info.uptime}s`,
          );
        } catch (err) {
          appendSystemNotice(
            `Info: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/sessions",
      description: "List active sessions",
      keywords: "list sessions show",
      action: async () => {
        try {
          const result = await sdk.sessions.list();
          appendSystemNotice(
            `Sessions: ${result.items?.length ?? 0} active.`,
          );
        } catch (err) {
          appendSystemNotice(
            err instanceof ApiError
              ? `Sessions: ${err.message}`
              : `Sessions error: ${String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/providers",
      description: "List available model providers",
      keywords: "models provider ai llm list",
      action: async () => {
        try {
          const providers = await sdk.providers.list();
          const names = (providers.items ?? [])
            .map((p) => `${p.id} (${p.status})`)
            .join(", ");
          appendSystemNotice(`Providers: ${names || "none"}`);
        } catch (err) {
          appendSystemNotice(
            `Providers: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/tools",
      description: "List available tools",
      keywords: "tool list capabilities bash read grep",
      action: async () => {
        try {
          const result = await sdk.tools.list();
          const names = (result.items ?? []).map((t) => t.name).join(", ");
          appendSystemNotice(`Tools: ${names || "none"}`);
        } catch (err) {
          appendSystemNotice(
            `Tools: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        close();
      },
    },
    {
      name: "/clear",
      description: "Clear message timeline (local only)",
      keywords: "reset clean wipe empty",
      action: () => {
        setMessages([]);
        appendSystemNotice("Timeline cleared.");
        close();
      },
    },
    {
      name: "/export",
      description: "Export current session messages",
      keywords: "export save json download conversation",
      action: async () => {
        try {
          const { activeSessionId: asid } = await import("../../state/app");
          const id = asid();
          if (!id) {
            appendSystemNotice("No active session to export.");
            close();
            return;
          }
          const msgs = await sdk.messages.list(id);
          appendSystemNotice(
            `Exported ${msgs.items?.length ?? 0} messages from session "${id}".`,
          );
        } catch {
          appendSystemNotice("Export failed.");
        }
        close();
      },
    },
    {
      name: "/close",
      description: "Close command palette",
      keywords: "exit quit dismiss",
      action: () => close(),
    },
  ];

  const filtered = createMemo(() => {
    const q = query();
    if (!q) return staticCommands;
    return staticCommands.filter(
      (c) =>
        fuzzyMatch(q, c.name) ||
        fuzzyMatch(q, c.description) ||
        fuzzyMatch(q, c.keywords),
    );
  });

  const displayHeight = () => Math.max(filtered().length + 4, 8);

  return (
    <box
      position="absolute"
      top={2}
      left={3}
      width={62}
      height={displayHeight()}
      border={true}
      title=" Command Palette  [type to search · ↑↓ navigate · Enter select] "
      titleAlignment="center"
      zIndex={10}
      flexDirection="column"
      padding={1}
    >
      {/* Search query display */}
      <box
        height={1}
        flexDirection="row"
        flexShrink={0}
        border={false}
      >
        <text content={`  > ${query()}█`} />
      </box>
      <text content="" />

      {/* Command list */}
      <For each={filtered().slice(0, 20)}>
        {(cmd, idx) => {
          const isSelected = () => idx() === selectedIndex();
          return (
            <box
              height={1}
              flexDirection="row"
              flexShrink={0}
              onMouseDown={() => executeCommand(cmd)}
            >
              <text
                content={`${isSelected() ? "▶" : " "} ${cmd.name.padEnd(16)}  ${cmd.description}`}
                flexGrow={1}
              />
            </box>
          );
        }}
      </For>
      <ShowWhenEmpty commands={filtered()} query={query()} />
    </box>
  );
}

function ShowWhenEmpty(props: {
  commands: PaletteCommand[];
  query: string;
}): JSX.Element {
  return (
    <Show when={props.query.length > 0 && props.commands.length === 0}>
      <box flexDirection="column" flexGrow={1} padding={1}>
        <text content={`  No commands match "${props.query}"`} />
      </box>
    </Show>
  );
}
