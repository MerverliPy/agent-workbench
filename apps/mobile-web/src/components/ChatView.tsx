import type { JSX } from "solid-js";
import { createEffect, createSignal, For, Show } from "solid-js";
import {
  isStreaming,
  messages,
  setInputText,
  streamingContent,
} from "../state/app";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";

const SUGGESTED_PROMPTS = [
  "What can you help me with?",
  "Show me the project structure",
  "Explain the code in src/",
  "Run git status",
];

export function ChatView(): JSX.Element {
  let scrollRef: HTMLDivElement | undefined;
  const [isNearBottom, setIsNearBottom] = createSignal(true);

  function scrollToBottom(smooth = false): void {
    if (scrollRef) {
      scrollRef.scrollTo({
        top: scrollRef.scrollHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }

  function checkNearBottom(): void {
    if (scrollRef) {
      const threshold = 80;
      setIsNearBottom(
        scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight <
          threshold,
      );
    }
  }

  // Auto-scroll on new messages/streaming — but only if user is near bottom
  createEffect(() => {
    void messages();
    void isStreaming();
    void streamingContent();
    queueMicrotask(() => {
      if (isNearBottom()) {
        scrollToBottom(isStreaming());
      }
    });
  });

  return (
    <div class="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        class="absolute inset-0 overflow-y-auto px-3 py-2"
        onScroll={() => checkNearBottom()}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <Show
          when={messages().length > 0 || isStreaming()}
          fallback={<EmptyState />}
        >
          <div class="space-y-2">
            <For each={messages()}>
              {(msg) => <MessageBubble message={msg} />}
            </For>
          </div>
          {isStreaming() && streamingContent() && (
            <div class="flex items-start gap-2 mt-2">
              <div class="flex-1 bg-slate-800 rounded-xl rounded-bl-md px-3.5 py-2.5 min-w-0">
                <span class="text-sm text-slate-200 whitespace-pre-wrap break-words">
                  {streamingContent()}
                </span>
                <StreamingIndicator />
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Floating scroll-to-bottom button */}
      <Show when={!isNearBottom() && messages().length > 0}>
        <button
          class="absolute bottom-4 right-4 w-10 h-10 bg-blue-500 rounded-full shadow-lg shadow-blue-500/20 flex items-center justify-center z-10 animate-fade-in active:bg-blue-600 transition-colors"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to bottom"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </Show>
    </div>
  );
}

/** Empty state shown when there are no messages. */
function EmptyState(): JSX.Element {
  function fillPrompt(text: string): void {
    setInputText(text);
    queueMicrotask(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type a message..."]',
      );
      textarea?.focus();
    });
  }

  return (
    <div class="flex flex-col items-center justify-center h-full px-7 py-10 text-center">
      <div class="text-[44px] mb-1" style="opacity: 0.25;" aria-hidden="true">
        💬
      </div>
      <h2
        class="text-lg font-semibold mb-1"
        style="font-family: var(--font-display); letter-spacing: -0.01em;"
      >
        agent-workbench
      </h2>
      <p
        class="text-sm leading-relaxed max-w-[280px]"
        style="color: var(--muted);"
      >
        Your AI coding companion. Ask questions, edit files, or run commands.
      </p>

      <div class="w-full max-w-[240px] mt-4 space-y-2">
        <span class="text-xs block text-center" style="color: var(--muted);">
          Try asking:
        </span>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            class="w-full text-left text-sm rounded-xl px-3.5 py-2.5 transition-colors min-h-[44px] border"
            style="color: var(--fg); border-color: var(--border);"
            onClick={() => fillPrompt(prompt)}
          >
            {prompt}
            <span class="block text-xs mt-0.5" style="color: var(--muted);">
              {prompt === "What can you help me with?"
                ? "Learn about your capabilities"
                : prompt === "Show me the project structure"
                  ? "Browse files in the current workspace"
                  : prompt === "Explain the code in src/"
                    ? "Get a code walkthrough"
                    : "Check repository status"}
            </span>
          </button>
        ))}
      </div>

      <p class="text-xs mt-6" style="color: var(--muted);">
        Connected via the agent-workbench server
      </p>
    </div>
  );
}
