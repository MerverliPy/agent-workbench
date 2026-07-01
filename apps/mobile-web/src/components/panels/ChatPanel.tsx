import type { JSX } from "solid-js";
import { ChatView } from "../ChatView";
import { PromptInput } from "../PromptInput";

export function ChatPanel(): JSX.Element {
  return (
    <div class="flex flex-col h-full">
      <ChatView />
      <PromptInput />
    </div>
  );
}
