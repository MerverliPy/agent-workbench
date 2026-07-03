import type { JSX } from "@opentui/solid";
import { For, Show } from "solid-js";
import {
  messages,
  streamingContent,
  streamingMessageId,
} from "../../state/app";

/** Role display labels. */
const ROLE_LABELS: Record<string, string> = {
  user: "[you]      ",
  assistant: "[assistant]",
  system: "[system]   ",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? `[${role}]     `;
}

/**
 * Scrollable message timeline.
 *
 * Renders the message history from the shared `messages` signal.
 * stickyScroll keeps the view pinned to the bottom as new messages arrive.
 *
 * Phase 4: messages are populated from:
 *  - Local optimistic user messages on submit
 *  - System notices (e.g. 501 placeholder feedback)
 *  - Future: SSE message.created events (Phase 6+)
 */
export function MessageTimeline(): JSX.Element {
  return (
    <scrollbox
      flexGrow={1}
      flexDirection="column"
      border={true}
      title=" Messages "
      titleAlignment="left"
      stickyScroll={true}
      stickyStart="bottom"
    >
      <Show
        when={messages().length > 0}
        fallback={
          <box flexGrow={1} flexDirection="column" padding={1}>
            <text content="╔══════════════════════════════════════════╗" />
            <text content="║       ✨  Welcome to agent-workbench   ║" />
            <text content="╚══════════════════════════════════════════╝" />
            <text content="" />
            <text content="Getting started:" />
            <text content="  Type a prompt below and press Ctrl+Enter to submit." />
            <text content="  Ctrl+P or Ctrl+K — Open command palette" />
            <text content="  Ctrl+/           — Show all keyboard shortcuts" />
            <text content="  Ctrl+1 / Ctrl+2  — Switch between Build / Plan agents" />
            <text content="  Ctrl+T           — Toggle token health panel" />
            <text content="  Ctrl+L           — Clear the timeline" />
            <text content="  Escape           — Close any open overlay" />
            <text content="" />
            <text content="Need help? Type /help in the prompt for more info." />
          </box>
        }
      >
        <For each={messages()}>
          {(msg) => (
            <box
              flexDirection="column"
              paddingX={1}
              paddingY={0}
              flexShrink={0}
            >
              <text
                content={`${roleLabel(msg.role)}  ${msg.createdAt.slice(11, 19)}`}
              />
              <text content={msg.content} flexGrow={1} />
              <text content="" />
            </box>
          )}
        </For>

        {/* Phase 16: Streaming message — rendered incrementally as deltas arrive */}
        <Show
          when={streamingMessageId() !== null && streamingContent().length > 0}
        >
          <box flexDirection="column" paddingX={1} paddingY={0} flexShrink={0}>
            <text content={`[assistant]  (streaming...)`} />
            <text content={streamingContent()} flexGrow={1} />
            <text content="▊" />
          </box>
        </Show>
      </Show>
    </scrollbox>
  );
}
