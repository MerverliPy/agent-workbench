import type { JSX } from "solid-js";
import { createSignal, For } from "solid-js";
import type { PlanCardData } from "../../state/app";

interface PlanCardProps {
  data: PlanCardData;
}

export function PlanCard(props: PlanCardProps): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(false);

  const label = () => {
    if (props.data.status === "approved") return "✓ Approved";
    if (props.data.status === "denied") return "✗ Denied";
    return collapsed()
      ? `▸ Plan (${props.data.steps.length} steps)`
      : "Plan";
  };

  return (
    <div
      class="rounded-xl px-4 py-3.5 border self-stretch max-w-full"
      style="background: var(--accent-dim); border-color: color-mix(in oklch, var(--accent) 15%, transparent);"
    >
      {/* Collapsible header */}
      <button
        class="flex items-center gap-1.5 w-full text-left"
        style={
          "cursor: pointer; user-select: none; font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: " +
          (collapsed() ? "var(--muted)" : "var(--fg)") +
          "; margin-bottom: " +
          (collapsed() ? "0" : "10px") +
          ";"
        }
        onClick={() => setCollapsed(!collapsed())}
        aria-expanded={!collapsed()}
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          style="background: color-mix(in oklch, var(--accent) 40%, var(--muted));"
        />
        {label()}
      </button>

      {/* Steps */}
      <div
        class="flex flex-col gap-1 overflow-hidden transition-all duration-250"
        style={
          "max-height: " +
          (collapsed() ? "0" : "500px") +
          "; opacity: " +
          (collapsed() ? "0" : "1") +
          ";"
        }
      >
        <For each={props.data.steps}>
          {(step) => {
            const icon = () => {
              if (step.status === "completed") return "✓";
              if (step.status === "in_progress") return "◌";
              if (step.status === "failed") return "✗";
              return "";
            };
            return (
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm"
                style="background: var(--accent-dim);"
              >
                <span class="font-mono text-xs font-semibold min-w-[20px]">
                  {icon()}
                </span>
                <span
                  class="font-mono text-xs font-semibold min-w-[20px] shrink-0"
                  style="color: var(--muted);"
                >
                  {step.number}.
                </span>
                <span style="color: var(--fg);">{step.description}</span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
