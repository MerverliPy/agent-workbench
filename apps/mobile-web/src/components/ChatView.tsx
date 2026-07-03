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
    // Focus the textarea after setting the value
    queueMicrotask(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type a message..."]',
      );
      textarea?.focus();
    });
  }

  return (
    <div class="flex flex-col items-center justify-center h-full px-4 py-12">
      <div class="text-center mb-6">
        <div class="text-4xl mb-3">🤖</div>
        <h2 class="text-lg font-semibold text-slate-200 mb-1">
          agent-workbench
        </h2>
        <p class="text-sm text-slate-500 max-w-xs">
          Your AI coding companion. Ask questions, edit files, or run commands.
        </p>
      </div>

      <div class="w-full max-w-xs space-y-2 mb-6">
        <span class="text-xs text-slate-500 block text-center mb-1">
          Try asking:
        </span>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            class="w-full text-left text-sm text-slate-300 bg-slate-800/60 hover:bg-slate-800 active:bg-slate-700 rounded-xl px-3.5 py-3 transition-colors border border-slate-700/50 min-h-[44px]"
            onClick={() => fillPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <p class="text-xs text-slate-600">
        Connected via the agent-workbench server
      </p>
    </div>
  );
}
