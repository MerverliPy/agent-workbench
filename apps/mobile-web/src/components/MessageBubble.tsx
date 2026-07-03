import { marked } from "marked";
import type { JSX } from "solid-js";

// Configure marked for safe rendering (no HTML in input)
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
  };
}

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
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

export function MessageBubble(props: MessageBubbleProps): JSX.Element {
  const { role, content, createdAt } = props.message;

  if (role === "system") {
    return (
      <div class="flex justify-center">
        <span class="text-xs text-slate-500 italic px-3 py-1">{content}</span>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        class={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700/40"
        }`}
      >
        {isUser ? (
          <span class="text-sm whitespace-pre-wrap break-words">{content}</span>
        ) : (
          <div
            class="text-sm markdown-body"
            // eslint-disable-next-line solid/no-innerhtml
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

/** Format ISO timestamp to short time string (e.g. "10:42 AM"). */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
