import type { JSX } from "solid-js";
import { createSignal } from "solid-js";
import { getClient } from "../lib/sdk";
import {
  appendMessage,
  inputText,
  selectedSessionId,
  setInputText,
  setSelectedSessionId,
} from "../state/app";

export function PromptInput(): JSX.Element {
  const [submitting, setSubmitting] = createSignal(false);
  let submittingRef = false;
  let textareaRef: HTMLTextAreaElement | undefined;

  async function submit(): Promise<void> {
    const content = inputText().trim();
    if (!content || submitting() || submittingRef) return;

    submittingRef = true;
    setSubmitting(true);
    const messageText = content;
    setInputText("");

    appendMessage({
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    });

    try {
      const client = getClient();
      let sessionId = selectedSessionId();

      if (!sessionId) {
        const sessions = await client.sessions.list();
        sessionId = sessions.items[0]?.id ?? null;
      }

      if (!sessionId) {
        const newSession = await client.sessions.create({
          projectPath: "/",
          title: "Mobile Session",
        });
        sessionId = newSession.id;
        setSelectedSessionId(sessionId);
      }

      const response = await client.messages.submit(sessionId, {
        content: messageText,
        role: "user",
      });

      if (response && response.role === "assistant" && response.content) {
        appendMessage({
          id: response.id ?? `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          createdAt: response.createdAt ?? new Date().toISOString(),
        });
      }
    } catch (err) {
      appendMessage({
        id: `error-${Date.now()}`,
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : "Failed to send"}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      submittingRef = false;
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize(): void {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 128)}px`;
  }

  const hasText = () => inputText().trim().length > 0;

  function handleFocus(): void {
    // Small delay to let the keyboard open and layout settle
    setTimeout(() => {
      textareaRef?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }

  return (
    <div
      data-composer
      class="flex-shrink-0 safe-bottom"
      style="padding: 8px 10px calc(8px + var(--safe-bottom)); border-top: 1px solid var(--border); background: var(--surface);"
    >
      <div class="flex items-end gap-1.5">
        {/* Attach button */}
        <button
          class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors"
          style="color: var(--muted);"
          aria-label="Attach file"
          disabled={submitting()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        {/* Pill-shaped input */}
        <div
          class="flex items-center flex-1 min-w-0 gap-1"
          style="background: var(--bg); border: 1px solid var(--border); border-radius: 22px; padding: 6px 12px; transition: border-color 0.15s, background 0.2s;"
        >
          {/* Model badge */}
          <span
            class="text-[11px] font-mono font-medium whitespace-nowrap shrink-0 pr-1.5"
            style="color: var(--fg); border-right: 1px solid var(--border);"
          >
            Agent
          </span>

          {/* Textarea (auto-resizing, single-line at rest) */}
          <textarea
            ref={textareaRef}
            class="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed"
            style="color: var(--fg); padding: 4px 0; min-height: 24px; max-height: 128px;"
            placeholder="Type a message..."
            rows={1}
            value={inputText()}
            onFocus={handleFocus}
            onInput={(e) => {
              setInputText((e.target as HTMLTextAreaElement).value);
              queueMicrotask(() => autoResize());
            }}
            onKeyDown={handleKeyDown}
            disabled={submitting()}
          />
        </div>

        {/* Mic button */}
        <button
          class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors"
          style="color: var(--muted);"
          aria-label="Voice input"
          disabled={submitting()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>

        {/* Send button */}
        <button
          class="flex items-center justify-center w-11 h-11 rounded-full shrink-0 transition-all"
          style={
            "background: " +
            (hasText() && !submitting()
              ? "var(--accent)"
              : "color-mix(in oklch, var(--accent) 30%, var(--border))") +
            "; color: var(--surface);"
          }
          onClick={submit}
          disabled={!hasText() || submitting()}
          aria-label="Send message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
