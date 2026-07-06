import type { JSX } from "solid-js";
import { Show } from "solid-js";
import type { TerminalCardData } from "../../state/app";

interface TerminalCardProps {
  data: TerminalCardData;
}

export function TerminalCard(props: TerminalCardProps): JSX.Element {
  const exitDisplay = () => {
    if (props.data.exitCode === undefined) return "";
    return props.data.exitCode === 0 ? "exit code: 0" : "exit code: " + props.data.exitCode;
  };

  return (
    <div
      class="rounded-xl border self-stretch max-w-full"
      style="background: oklch(22% 0.015 250); border-color: oklch(30% 0.015 250);"
    >
      {/* Window chrome header */}
      <div
        class="flex items-center gap-2 px-3.5 py-2 text-xs font-mono border-b"
        style="color: oklch(70% 0.01 250); border-bottom-color: oklch(35% 0.015 250);"
      >
        <span class="text-[6px] tracking-[3px]" style="color: oklch(45% 0.01 250);" aria-hidden="true">
          ⬤ ⬤ ⬤
        </span>
        <span style="color: oklch(70% 0.01 250);">Terminal Output</span>
      </div>

      {/* Output */}
      <pre
        class="text-[13px] font-mono leading-relaxed px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap break-all"
        style="color: oklch(90% 0.004 255);"
      >
        <span style="color: oklch(85% 0.004 255);">$ {props.data.command}</span>
        {"\n"}
        {props.data.output}
      </pre>

      {/* Footer */}
      <div
        class="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono border-t"
        style="color: oklch(55% 0.01 250); border-top-color: oklch(35% 0.015 250);"
      >
        <Show when={props.data.riskLevel}>
          <span
            class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
            style={
              "background: " +
              (props.data.riskLevel === "high"
                ? "color-mix(in oklch, var(--danger) 20%, transparent)"
                : props.data.riskLevel === "medium"
                  ? "color-mix(in oklch, var(--warn) 20%, transparent)"
                  : "color-mix(in oklch, var(--success) 20%, transparent)") +
              "; color: " +
              (props.data.riskLevel === "high"
                ? "var(--danger)"
                : props.data.riskLevel === "medium"
                  ? "var(--warn)"
                  : "var(--success)") +
              ";"
            }
          >
            {props.data.riskLevel} risk
          </span>
        </Show>
        <Show when={exitDisplay()}>
          <span>{exitDisplay()}</span>
        </Show>
        <Show when={props.data.status === "in_progress"}>
          <span style="color: var(--accent);">running...</span>
        </Show>
        <Show when={props.data.error}>
          <span style="color: var(--danger);">{props.data.error}</span>
        </Show>
      </div>
    </div>
  );
}
