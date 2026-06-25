import type { JSX } from "@opentui/solid";
import { PLACEHOLDER_SESSION, serverStatus } from "../../state/app";

/**
 * Session sidebar.
 *
 * Phase 4: shows the single placeholder session.
 * Server session list (GET /session) returns 501 — real sessions are Phase 5+.
 */
export function SessionSidebar(): JSX.Element {
  return (
    <box
      width={24}
      flexShrink={0}
      flexDirection="column"
      border={true}
      title=" Sessions "
      titleAlignment="center"
    >
      {/* Placeholder session entry */}
      <box height={3} flexDirection="column" paddingX={1}>
        <text content={`> ${PLACEHOLDER_SESSION.title}`} />
        <text content={`  [${PLACEHOLDER_SESSION.status}]`} />
      </box>

      {/* Note about real session API availability */}
      <box flexGrow={1} flexDirection="column" paddingX={1}>
        <text content="" />
        <text content="Session list:" />
        <text content={serverStatus() === "connected" ? "unavailable (Phase 5)" : "server offline"} />
      </box>
    </box>
  );
}
