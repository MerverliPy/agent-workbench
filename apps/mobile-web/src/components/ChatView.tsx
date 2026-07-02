import type { JSX } from "solid-js";
import { For, createEffect, Show } from "solid-js";
import { messages, isStreaming, streamingContent } from "../state/app";
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
  let isNearBottom = true;

  function scrollToBottom(smooth = false): void {
    if (scrollRef) {
      scrollRef.scrollTo({
        top: scrollRef.scrollHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }

  // Track whether user is scrolled near the bottom
  function checkNearBottom(): void {
    if (scrollRef) {
      const threshold = 80;
      isNearBottom =
        scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight <
        threshold;
    }
  }

  // Auto-scroll on new messages/streaming — but only if user is near bottom
  createEffect(() => {
    void messages();
    void isStreaming();
    void streamingContent();
    queueMicrotask(() => {
      if (isNearBottom) {
        scrollToBottom(isStreaming());
      }
    });
  });

  // Detect manual scroll-away
  function handleScroll(): void {
    checkNearBottom();
  }

  return (
    <div
      ref={scrollRef}
      class="flex-1 overflow-y-auto px-3 py-2"
      onScroll={handleScroll}
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
  );
}

/** Empty state shown when there are no messages. */
function EmptyState(): JSX.Element {
  function fillPrompt(text: string): void {
    // Find the textarea and set its value
    const textarea = document.querySelector(
      'textarea[placeholder="Type a message..."]',
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(textarea, text);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
    }
  }

  return (
    <div class="flex flex-col items-center justify-center h-full px-4 py-12">
      <div class="text-center mb-6">
        <div class="text-4xl mb-3">🤖</div>
        <h2 class="text-lg font-semibold text-slate-200 mb-1">
          agent-workbench
        </h2>
        <p class="text-sm text-slate-500 max-w-xs">
          Your AI coding companion. Ask questions, edit files, or run
          commands.
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
