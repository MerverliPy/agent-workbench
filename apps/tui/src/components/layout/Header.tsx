import type { JSX } from "@opentui/solid";
import { SERVER_BASE_URL } from "../../lib/sdk";
import { currentAgentId, serverStatus } from "../../state/app";

export function Header(): JSX.Element {
  const status = serverStatus();
  const agent = currentAgentId();
  const agentLabel = agent !== null ? `${agent}` : "none";

  return (
    <box height={1} flexDirection="row" flexShrink={0}>
      <text
        content={`agent-workbench  |  server: ${SERVER_BASE_URL}  |  status: ${status}  |  agent: ${agentLabel}  |  [Ctrl+1] Build  [Ctrl+2] Plan  |  [Ctrl+P] palette`}
        flexGrow={1}
      />
    </box>
  );
}
