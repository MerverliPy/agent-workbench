import type { JSX } from "@opentui/solid";
import { serverStatus, serverError, runStatus, pendingPermissions, tokenHealth } from "../../state/app";
import { SERVER_BASE_URL } from "../../lib/sdk";

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

    const th = tokenHealth();
    const tokenPart =
      th !== null
        ? `  | tokens: ${th.used}/${th.budget} (${th.level}${th.isEstimate ? "~" : ""})`
        : "  | tokens: --";

    return (
      ` ${SERVER_BASE_URL}  |  server: ${svr}${errPart}  |  run: ${run}${permPart}` +
      `${tokenPart}  |  agent: --  |  [Ctrl+P] palette  [Ctrl+T] tokens  [Ctrl+C] exit`
    );
  }

  return (
    <box height={1} flexShrink={0} flexDirection="row">
      <text content={statusLine()} flexGrow={1} />
    </box>
  );
}
