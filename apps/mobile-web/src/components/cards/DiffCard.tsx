import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import type { DiffCardData } from "../../state/app";

interface DiffCardProps {
  data: DiffCardData;
}

function tagStyle(type: "modified" | "added" | "removed"): {
  label: string;
  bg: string;
  color: string;
} {
  if (type === "modified")
    return { label: "Modified", bg: "var(--warn-dim)", color: "var(--warn)" };
  if (type === "added")
    return {
      label: "Added",
      bg: "var(--success-soft)",
      color: "var(--success)",
    };
  return { label: "Removed", bg: "var(--danger-soft)", color: "var(--danger)" };
}

export function DiffCard(props: DiffCardProps): JSX.Element {
  return (
    <div
      class="rounded-xl px-4 py-3.5 border self-stretch max-w-full"
      style="background: var(--surface); border-color: var(--border);"
    >
      <div
        class="flex items-center gap-1.5 mb-2.5"
        style="font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted);"
      >
        <span
          class="w-2 h-2 shrink-0"
          style="background: color-mix(in oklch, var(--success) 50%, var(--danger) 50%); border-radius: 2px;"
        />
        File Changes
      </div>

      <For each={props.data.files}>
        {(file) => {
          const tag = tagStyle(file.type);
          return (
            <div class="mb-2 last:mb-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span
                  class="inline-block px-[7px] py-[1px] rounded text-[10px] font-semibold uppercase tracking-[0.04em]"
                  style={`background: ${tag.bg}; color: ${tag.color};`}
                >
                  {tag.label}
                </span>
                <span
                  class="text-xs font-mono truncate"
                  style="color: var(--fg);"
                >
                  {file.path}
                </span>
              </div>
              <Show when={file.diff}>
                <pre
                  class="text-xs font-mono leading-relaxed px-3 py-2.5 rounded-lg overflow-x-auto whitespace-pre"
                  style="background: var(--code-bg); color: var(--code-fg);"
                >
                  {file.diff}
                </pre>
              </Show>
            </div>
          );
        }}
      </For>

      <Show when={props.data.files.length === 0}>
        <div class="text-xs" style="color: var(--muted);">
          No file changes
        </div>
      </Show>
    </div>
  );
}
