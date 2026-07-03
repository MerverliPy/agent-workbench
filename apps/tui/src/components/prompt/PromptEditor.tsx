import { ApiError } from "@agent-workbench/sdk";
import type { TextareaRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createSignal } from "solid-js";
import { sdk } from "../../lib/sdk";
import {
  activeSessionId,
  appendMessage,
  appendSystemNotice,
  PLACEHOLDER_SESSION_ID,
  serverStatus,
  setRunStatus,
} from "../../state/app";

/**
 * Prompt editor.
 *
 * Multi-line textarea. Key bindings:
 *   Enter         — insert newline
 *   Ctrl+Enter    — submit prompt to server
 *   Ctrl+C        — handled by renderer (exits TUI)
 *
 * Submit behavior:
 *  1. Sends POST /session/:id/message via sdk.messages.submit().
 *  2. Server returns 501 (Phase 3 placeholder) → shows notice in timeline.
 *  3. On success (future Phase 6+) → server will echo the message.
 *
 * Phase 4: does NOT implement a fake agent response.
 */
export function PromptEditor(): JSX.Element {
  let textareaRef: TextareaRenderable | undefined;
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  async function handleSubmit(): Promise<void> {
    if (isSubmitting()) return;

    const content = textareaRef?.editBuffer.getText().trim() ?? "";
    if (!content) return;

    // Optimistically append user message to timeline
    appendMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    });

    // Clear textarea immediately
    textareaRef?.clear();

    setIsSubmitting(true);
    setRunStatus("submitting");

    try {
      await sdk.messages.submit(activeSessionId() ?? PLACEHOLDER_SESSION_ID, {
        content,
        role: "user",
      });
      // If we reach here (Phase 6+), the server acknowledged the message.
      // Events will carry the assistant response via SSE.
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        appendSystemNotice(
          "Runtime not implemented yet; prompt submission reached the server placeholder. " +
            "The agent runtime will be connected in Phase 6.",
        );
      } else if (err instanceof ApiError) {
        appendSystemNotice(`Server error (${err.status}): ${err.message}`);
      } else {
        appendSystemNotice(
          `Submit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } finally {
      setIsSubmitting(false);
      setRunStatus("idle");
    }
  }

  const isDisabled = (): boolean =>
    isSubmitting() ||
    serverStatus() === "disconnected" ||
    serverStatus() === "error";

  return (
    <box
      height={5}
      flexShrink={0}
      flexDirection="column"
      border={true}
      title={
        isDisabled()
          ? " Prompt (server offline) "
          : " Prompt  [Enter=newline  Ctrl+Enter=submit] "
      }
      titleAlignment="left"
    >
      <textarea
        ref={(el) => {
          textareaRef = el;
        }}
        focused={true}
        flexGrow={1}
        placeholder={
          isDisabled() ? "Server not connected…" : "Type your prompt here…"
        }
        keyBindings={[{ name: "return", ctrl: true, action: "submit" }]}
        onSubmit={() => {
          void handleSubmit();
        }}
        wrapMode="word"
      />
    </box>
  );
}
