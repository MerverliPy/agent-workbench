import type { JSX } from "@opentui/solid";
import { setPermissionModalOpen } from "../../state/app";

/**
 * Permission modal — Phase 4 placeholder.
 *
 * In Phase 8, this modal will display:
 *   - Tool name and risk level
 *   - Reason and target paths
 *   - Command / diff / dry-run preview
 *   - Approve / Deny buttons
 *
 * The TUI never evaluates the permission policy. It displays backend-provided
 * data (from SSE permission.requested events) and sends the decision via
 * sdk.permissions.decide(). That wiring is Phase 8 work.
 *
 * Phase 4: renders a placeholder notice only.
 */
export function PermissionModal(): JSX.Element {
  return (
    <box
      position="absolute"
      top={4}
      left={8}
      width={56}
      height={10}
      border={true}
      title=" Permission Request "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text content="[Phase 4 placeholder — Permission Modal]" />
      <text content="" />
      <text content="Real permission approve/deny UI is a Phase 8 feature." />
      <text content="Pending requests will appear here once the permission" />
      <text content="engine is connected." />
      <text content="" />
      <box
        height={1}
        flexDirection="row"
        onMouseDown={() => setPermissionModalOpen(false)}
      >
        <text content="  [close]" />
      </box>
    </box>
  );
}
