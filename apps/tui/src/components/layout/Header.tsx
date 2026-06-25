import type { JSX } from "@opentui/solid";
import { serverStatus } from "../../state/app";
import { SERVER_BASE_URL } from "../../lib/sdk";

/**
 * Single-row header bar showing project context and server connection.
 * Phase 4: shows server URL and live connection status.
 */
export function Header(): JSX.Element {
  return (
    <box height={1} flexDirection="row" flexShrink={0}>
      <text
        content={`agent-workbench  |  server: ${SERVER_BASE_URL}  |  status: ${serverStatus()}  |  session: phase4-placeholder  |  [Ctrl+P] palette`}
        flexGrow={1}
      />
    </box>
  );
}
