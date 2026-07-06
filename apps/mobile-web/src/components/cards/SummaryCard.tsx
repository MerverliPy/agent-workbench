import DOMPurify from "dompurify";
import { marked } from "marked";
import type { JSX } from "solid-js";
import type { SummaryCardData } from "../../state/app";

interface SummaryCardProps {
  data: SummaryCardData;
}

function renderMarkdown(text: string): string {
  try {
    const raw = marked.parse(text) as string;
    return DOMPurify.sanitize(raw);
  } catch {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

export function SummaryCard(props: SummaryCardProps): JSX.Element {
  return (
    <div
      class="rounded-xl px-4 py-3.5 self-stretch max-w-full"
      style="border-left: 3px solid var(--accent); background: var(--surface); border: 1px solid var(--border);"
    >
      <div
        class="flex items-center gap-1.5 mb-2.5"
        style="font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--accent);"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          style="background: var(--muted);"
        />
        Final
      </div>

      <div
        class="text-sm leading-relaxed markdown-body"
        style="color: var(--fg);"
        innerHTML={
          props.data.content
            ? renderMarkdown(props.data.content)
            : props.data.items
              ? "<ul>" +
                props.data.items.map((i) => `<li>${i}</li>`).join("") +
                "</ul>"
              : ""
        }
      />
    </div>
  );
}
