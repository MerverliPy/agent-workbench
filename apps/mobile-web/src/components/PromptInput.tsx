import type { JSX } from "solid-js";
import { createSignal } from "solid-js";
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
        // No sessions exist — create a new one
        const newSession = await client.sessions.create({
          projectPath: "/",
          title: "Mobile Session",
        });
        sessionId = newSession.id;
        setSelectedSessionId(sessionId);
      }

      const response = await client.messages.submit(sessionId, { content: messageText, role: "user" });

      // Append assistant response immediately (SSE handles streaming updates).
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

  return (
    <div class="flex items-end gap-2 px-3 py-2 bg-slate-900 border-t border-slate-700 safe-bottom shrink-0">
      <textarea
        class="flex-1 bg-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[40px] max-h-32"
        placeholder="Type a message..."
        rows={1}
        value={text()}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        disabled={submitting()}
      />
      <button
        class={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors shrink-0 ${
          text().trim() && !submitting()
            ? "bg-blue-600 active:bg-blue-700 text-white"
            : "bg-slate-700 text-slate-500"
        }`}
        onClick={submit}
        disabled={!text().trim() || submitting()}
        aria-label="Send message"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
