import type { JSX } from "@opentui/solid";
import { setDiffViewerOpen } from "../../state/app";

/**
 * Diff viewer — Phase 4 placeholder.
 *
 * In Phase 9, this panel will display:
 *   - File path and change type
 *   - Unified diff with added/removed line counts
 *   - Approval state and dry-run result
 *   - Revert hint
 *
 * Real diff display requires the diff engine (packages/diff) and file
 * mutation tools (Phase 9). No diff logic lives in the TUI.
 *
 * Phase 4: renders a placeholder notice only.
 */
export function DiffViewer(): JSX.Element {
  return (
    <box
      position="absolute"
      top={4}
      left={8}
      width={56}
      height={10}
      border={true}
      title=" Diff Viewer "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text content="[Phase 4 placeholder — Diff Viewer]" />
      <text content="" />
      <text content="Diff preview is a Phase 9 feature." />
      <text content="File mutation diffs will appear here once the diff" />
      <text content="engine and file mutation tools are connected." />
      <text content="" />
      <box
        height={1}
        flexDirection="row"
        onMouseDown={() => setDiffViewerOpen(false)}
      >
        <text content="  [close]" />
      </box>
    </box>
  );
}
