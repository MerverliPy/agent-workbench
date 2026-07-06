import DOMPurify from "dompurify";
import { marked } from "marked";
import type { JSX } from "solid-js";
import { CardRegistry } from "./cards/CardRegistry";

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
    cardType?: string;
    cardData?: unknown;
  };
}

function renderMarkdown(text: string): string {
  try {
    const raw = marked.parse(text) as string;
    return DOMPurify.sanitize(raw);
  } catch {
    return escapeHtml(text);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MessageBubble(props: MessageBubbleProps): JSX.Element {
  const { role, content, createdAt, cardType, cardData } = props.message;

  if (role === "system") {
    return (
      <div class="flex justify-center msg-in">
        <span class="text-xs italic px-3 py-1" style="color: var(--muted);">
          {content}
        </span>
      </div>
    );
  }

  // Card type messages get rendered by CardRegistry
  if (cardType && cardData) {
    return (
      <div class="msg-in">
        <CardRegistry
          cardType={
            cardType as
              | "plan"
              | "tool"
              | "diff"
              | "terminal"
              | "approval"
              | "summary"
          }
          cardData={cardData}
        />
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div class={`flex msg-in ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        class={
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 " +
          (isUser ? "rounded-br-md" : "rounded-bl-md")
        }
        style={
          isUser
            ? "background: var(--fg); color: var(--surface);"
            : "background: var(--surface); color: var(--fg); border: 1px solid var(--border);"
        }
      >
        {isUser ? (
          <span class="text-sm whitespace-pre-wrap break-words">{content}</span>
        ) : (
          <div
            class="text-sm markdown-body"
            innerHTML={renderMarkdown(content)}
          />
        )}
        <p class="text-[10px] mt-1 opacity-50 text-right">
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}
