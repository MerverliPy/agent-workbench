import type { JSX } from "@opentui/solid";
import { serverStatus, serverError, runStatus, pendingPermissions } from "../../state/app";
import { SERVER_BASE_URL } from "../../lib/sdk";

/**
 * Single-row status bar.
 *
 * Shows: server connection | run state | pending permissions | keyboard hint
 *
 * Phase 4: token health and agent/model info are placeholders.
 * These will be populated from SSE events in later phases.
 */
export function StatusBar(): JSX.Element {
  function statusLine(): string {
    const svr = serverStatus();
    const errPart =
      svr === "error" || svr === "disconnected"
        ? `  [${serverError() ?? "unreachable"}]`
        : "";

    const run = runStatus();
    const perms = pendingPermissions();
    const permPart = perms > 0 ? `  | permissions pending: ${perms}` : "";

    return (
      ` ${SERVER_BASE_URL}  |  server: ${svr}${errPart}  |  run: ${run}${permPart}` +
      `  |  tokens: --  |  agent: --  |  [Ctrl+P] palette  [Ctrl+C] exit`
    );
  }

  return (
    <box height={1} flexShrink={0} flexDirection="row">
      <text content={statusLine()} flexGrow={1} />
    </box>
  );
}
