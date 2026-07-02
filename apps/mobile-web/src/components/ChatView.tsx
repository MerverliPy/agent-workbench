import type { JSX } from "solid-js";
import { For, createEffect, onCleanup } from "solid-js";
import { messages, isStreaming, streamingContent } from "../state/app";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";

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
      const threshold = 80; // px from bottom considered "near bottom"
      isNearBottom =
        scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight < threshold;
    }
  }

  // Auto-scroll on new messages/streaming — but only if user is near bottom
  createEffect(() => {
    // Subscribe to these signals so the effect re-runs
    void messages();
    void isStreaming();
    void streamingContent();
    if (isNearBottom) {
      // Use microtask to let DOM settle after reactive updates
      queueMicrotask(() => scrollToBottom(isStreaming()));
    }
  });

  // Detect manual scroll-away
  function handleScroll(): void {
    checkNearBottom();
  }

  return (
    <div
      ref={scrollRef}
      class="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <For each={messages()}>
        {(msg) => <MessageBubble message={msg} />}
      </For>
      {isStreaming() && streamingContent() && (
        <div class="flex items-start gap-2">
          <div class="flex-1 bg-slate-800 rounded-xl px-3 py-2 min-w-0">
            <span class="text-sm text-slate-200 whitespace-pre-wrap break-words">
              {streamingContent()}
            </span>
            <StreamingIndicator />
          </div>
        </div>
      )}
    </div>
  );
}
