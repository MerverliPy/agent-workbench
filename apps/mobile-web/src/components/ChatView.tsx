import type { JSX } from "solid-js";
import { For, onMount } from "solid-js";
import { messages, isStreaming, streamingContent } from "../state/app";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";

export function ChatView(): JSX.Element {
  let scrollRef: HTMLDivElement | undefined;

  function scrollToBottom(): void {
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight;
    }
  }

  onMount(() => {
    scrollToBottom();
  });

  // Auto-scroll on new messages
  onMount(() => {
    const observer = new MutationObserver(() => scrollToBottom());
    if (scrollRef) observer.observe(scrollRef, { childList: true, subtree: true });
    return () => observer.disconnect();
  });

  return (
    <div
      ref={scrollRef}
      class="flex-1 overflow-y-auto px-3 py-2 space-y-2"
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
