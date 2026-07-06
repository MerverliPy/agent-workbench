import type { JSX } from "solid-js";
import { Show } from "solid-js";
import type { ToolActivityCardData } from "../../state/app";

interface ToolActivityCardProps {
  data: ToolActivityCardData;
}

export function ToolActivityCard(props: ToolActivityCardProps): JSX.Element {
  const icon = () => {
    if (props.data.status === "completed") return "✓";
    if (props.data.status === "failed" || props.data.status === "aborted")
      return "✗";
    if (props.data.status === "in_progress") return "◌";
    return "·";
  };

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
          style="background: var(--muted); border-radius: 2px;"
        />
        Tool Activity
      </div>

      <div
        class="flex items-center gap-2 py-1 text-xs font-mono border-b"
        style={
          "color: " +
          (props.data.status === "completed"
            ? "var(--success)"
            : props.data.status === "failed" || props.data.status === "aborted"
              ? "var(--danger)"
              : props.data.status === "in_progress"
                ? "var(--accent)"
                : "var(--muted)") +
          "; border-bottom-color: var(--border-soft);"
        }
      >
        <span class="font-semibold">{icon()}</span>
        <span>{props.data.toolName}</span>
        <Show when={props.data.status === "in_progress"}>
          <span style="color: var(--muted);">running...</span>
        </Show>
      </div>

      <Show when={props.data.result}>
        <div class="mt-1 py-1 text-xs font-mono" style="color: var(--muted);">
          {props.data.result}
        </div>
      </Show>

      <Show when={props.data.error}>
        <div class="mt-1 py-1 text-xs font-mono" style="color: var(--danger);">
          {props.data.error}
        </div>
      </Show>
    </div>
  );
}
