import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { getClient } from "../lib/sdk";
import { appendMessage, selectedSessionId, setSelectedSessionId } from "../state/app";

export function PromptInput(): JSX.Element {
  const [text, setText] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  async function submit(): Promise<void> {
    const content = text().trim();
    if (!content || submitting()) return;

    setSubmitting(true);
    const messageText = content;
    setText("");

    // Append user message immediately
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

      const response = await client.messages.submit(sessionId, { content: messageText, role: "user" });

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
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize(el: HTMLTextAreaElement): void {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  const hasText = () => text().trim().length > 0;

  return (
    <div class="flex-shrink-0 bg-slate-900 border-t border-slate-700 safe-bottom">
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-2 pt-1 pb-0.5">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-800 active:text-slate-300 transition-colors"
          aria-label="Attach file"
          disabled={submitting()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-800 active:text-slate-300 transition-colors"
          aria-label="Voice input"
          disabled={submitting()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>
        <Show when={submitting()}>
          <span class="text-[10px] text-slate-500 ml-auto">Connecting...</span>
        </Show>
      </div>

      {/* Input row */}
      <div class="flex items-end gap-2 px-3 pb-2">
        <textarea
          class="flex-1 bg-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[40px] max-h-32 transition-shadow"
          placeholder="Type a message..."
          rows={1}
          value={text()}
          onInput={(e) => {
            setText((e.target as HTMLTextAreaElement).value);
            autoResize(e.target as HTMLTextAreaElement);
          }}
          onKeyDown={handleKeyDown}
          disabled={submitting()}
        />
        <button
          class={`flex items-center justify-center w-11 h-11 rounded-xl transition-colors shrink-0 ${
            hasText() && !submitting()
              ? "bg-blue-600 active:bg-blue-700 text-white"
              : "bg-slate-700 text-slate-500"
          }`}
          onClick={submit}
          disabled={!hasText() || submitting()}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
