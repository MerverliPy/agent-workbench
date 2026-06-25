import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import { sdk } from "../../lib/sdk";
import {
  pendingPermissionRequests,
  setPermissionModalOpen,
} from "../../state/app";

/**
 * Permission modal — Phase 8 implementation.
 *
 * Renders the first pending permission request received via SSE.
 * Provides Approve / Deny buttons that call sdk.permissions.decide().
 *
 * The TUI:
 *   - Renders backend-provided data (tool name, risk level, reason, paths).
 *   - Sends the user's choice to the server via SDK.
 *   - Does NOT compute allow/ask/deny, risk level, path policy, or command policy.
 *   - Does NOT import @agent-workbench/permissions or any runtime authority package.
 *
 * Boundary contract: docs/03_BACKEND_FRONTEND_BOUNDARY.md §10 and §12.
 */
export function PermissionModal(): JSX.Element {
  const hasRequest = () => pendingPermissionRequests().length > 0;
  const firstRequest = () => pendingPermissionRequests()[0];

  async function handleDecision(decision: "allow" | "deny"): Promise<void> {
    const req = firstRequest();
    if (req === undefined) return;
    try {
      await sdk.permissions.decide(req.id, { decision });
    } catch (err) {
      // Decision submission failure — log; the server or gate will handle timeout.
      console.error("[PermissionModal] Failed to submit decision:", err);
    }
    // Close the modal once the user has acted (if no more pending requests).
    if (pendingPermissionRequests().length <= 1) {
      setPermissionModalOpen(false);
    }
  }

  const riskLabel = () => {
    const req = firstRequest();
    return req !== undefined ? `[${(req.riskLevel ?? "unknown").toUpperCase()}]` : "";
  };

  const toolName = () => firstRequest()?.toolName ?? "";
  const reason = () => firstRequest()?.reason ?? "(no reason provided)";
  const paths = () => firstRequest()?.targetPaths?.join(", ") ?? "";

  return (
    <Show when={hasRequest()}>
      <box
        position="absolute"
        top={4}
        left={6}
        width={60}
        height={14}
        border={true}
        title=" Permission Request "
        titleAlignment="center"
        zIndex={20}
        flexDirection="column"
        padding={1}
      >
        <text content={`Tool:      ${toolName()}  ${riskLabel()}`} />
        <text content={`Reason:    ${reason()}`} />
        <Show when={paths().length > 0}>
          <text content={`Paths:     ${paths()}`} />
        </Show>
        <text content="" />
        <text content="Allow this operation?" />
        <text content="" />
        <box height={1} flexDirection="row">
          <text
            content="  [Approve]"
            onMouseDown={() => void handleDecision("allow")}
          />
          <text content="    " />
          <text
            content="[Deny]"
            onMouseDown={() => void handleDecision("deny")}
          />
          <text content="    " />
          <text
            content="[Close]"
            onMouseDown={() => setPermissionModalOpen(false)}
          />
        </box>
      </box>
    </Show>
  );
}
