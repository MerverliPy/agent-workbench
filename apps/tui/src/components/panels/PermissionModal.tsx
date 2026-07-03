import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import { sdk } from "../../lib/sdk";
import {
  currentDiffPreview,
  pendingPermissionRequests,
  setPermissionModalOpen,
} from "../../state/app";

/**
 * Permission modal — Phase 8 / Phase 9.
 *
 * Renders the first pending permission request received via SSE.
 * Provides Approve / Deny buttons that call sdk.permissions.decide().
 *
 * Phase 9 addition: shows a "diff preview available" hint when the
 * DiffViewer is open alongside the permission modal.
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
  const hasDiff = () => currentDiffPreview() !== null;

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
    return req !== undefined
      ? `[${(req.riskLevel ?? "unknown").toUpperCase()}]`
      : "";
  };

  const toolName = () => firstRequest()?.toolName ?? "";
  const reason = () => firstRequest()?.reason ?? "(no reason provided)";
  const paths = () => firstRequest()?.targetPaths?.join(", ") ?? "";

  // Phase 10: shell command preview data from the permission request payload.
  const command = () => firstRequest()?.command ?? "";
  const normalizedCommand = () => {
    const preview = firstRequest()?.commandPreview as
      | Record<string, unknown>
      | undefined;
    if (preview !== undefined && typeof preview.normalized === "string") {
      return preview.normalized;
    }
    return command();
  };
  const isBash = () => toolName() === "bash";
  const matchedRules = () => {
    const preview = firstRequest()?.commandPreview as
      | Record<string, unknown>
      | undefined;
    if (preview !== undefined && Array.isArray(preview.matchedRules)) {
      return preview.matchedRules as string[];
    }
    return [];
  };

  return (
    <Show when={hasRequest()}>
      <box
        position="absolute"
        top={4}
        left={6}
        width={60}
        height={16}
        border={true}
        title=" Permission Request "
        titleAlignment="center"
        zIndex={20}
        flexDirection="column"
        padding={1}
      >
        <text content={`Tool:      ${toolName()}  ${riskLabel()}`} />
        <Show when={isBash() && normalizedCommand().length > 0}>
          <text content={`Command:   ${normalizedCommand()}`} />
          <Show when={matchedRules().length > 0}>
            <text content={`Matched:   ${matchedRules().join(", ")}`} />
          </Show>
        </Show>
        <Show when={!isBash()}>
          <text content={`Reason:    ${reason()}`} />
        </Show>
        <Show when={isBash()}>
          <text content={`Risk:      ${reason()}`} />
        </Show>
        <Show when={paths().length > 0}>
          <text content={`Paths:     ${paths()}`} />
        </Show>
        <Show when={hasDiff()}>
          <text content="" />
          <text content="  Diff preview is open in the viewer panel." />
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
