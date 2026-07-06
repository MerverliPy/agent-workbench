import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { getClient } from "../../lib/sdk";
import type { ApprovalCardData } from "../../state/app";

interface ApprovalCardProps {
  data: ApprovalCardData;
}

export function ApprovalCard(props: ApprovalCardProps): JSX.Element {
  const isDecided = () =>
    props.data.status === "approved" ||
    props.data.status === "denied" ||
    props.data.status === "expired";

  const borderColor = () => {
    if (props.data.status === "approved") return "var(--success)";
    if (props.data.status === "denied" || props.data.status === "expired")
      return "var(--danger)";
    return "var(--warn)";
  };

  const labelText = () => {
    if (props.data.status === "approved") return "✓ Approved";
    if (props.data.status === "denied") return "✗ Rejected";
    if (props.data.status === "expired") return "⌛ Expired";
    return `Approval ${props.data.sequenceNumber}/${props.data.totalCount}`;
  };

  const labelColor = () => {
    if (props.data.status === "approved") return "var(--success)";
    if (props.data.status === "denied" || props.data.status === "expired")
      return "var(--danger)";
    return "var(--warn)";
  };

  async function respond(allowed: boolean): Promise<void> {
    try {
      await getClient().permissions.decide(props.data.requestId, {
        decision: allowed ? "allow" : "deny",
      });
    } catch (err) {
      console.error("Permission decision failed:", err);
    }
  }

  return (
    <div
      class="rounded-xl px-4 py-3.5 self-stretch max-w-full"
      style={
        "border-left: 3px solid " +
        borderColor() +
        "; background: var(--surface); border: 1px solid var(--border);"
      }
    >
      <div
        class="flex items-center gap-1.5 mb-2.5"
        style={
          "font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: " +
          labelColor() +
          ";"
        }
      >
        <span class="text-xs" aria-hidden="true">
          ⚠
        </span>
        {labelText()}
      </div>

      <p class="text-sm leading-relaxed mb-3" style="color: var(--fg);">
        <strong>Run: </strong>
        {props.data.toolName}
        {props.data.targetPaths?.length
          ? ` — ${props.data.targetPaths.join(", ")}`
          : ""}
      </p>

      <Show when={props.data.riskLevel}>
        <div
          class="text-xs font-medium mb-3 px-2 py-1 rounded inline-block"
          style={
            "color: " +
            (props.data.riskLevel === "high"
              ? "var(--danger)"
              : props.data.riskLevel === "medium"
                ? "var(--warn)"
                : "var(--success)") +
            "; background: " +
            (props.data.riskLevel === "high"
              ? "var(--danger-soft)"
              : props.data.riskLevel === "medium"
                ? "var(--warn-soft)"
                : "var(--success-soft)") +
            ";"
          }
        >
          {props.data.riskLevel.toUpperCase()} RISK
        </div>
      </Show>

      <Show when={!isDecided()}>
        <div class="flex gap-2">
          <button
            class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style="background: var(--fg); color: var(--surface);"
            onClick={() => respond(true)}
          >
            ✓ Approve
          </button>
          <button
            class="flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style="background: transparent; color: var(--fg); border-color: var(--border);"
            onClick={() => respond(false)}
          >
            ✕ Reject
          </button>
        </div>
      </Show>
    </div>
  );
}
