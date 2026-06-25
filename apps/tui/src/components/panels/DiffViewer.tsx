import type { JSX } from "@opentui/solid";
import { For, Show } from "solid-js";
import { currentDiffPreview, setCurrentDiffPreview, setDiffViewerOpen } from "../../state/app";

/**
 * Diff viewer — Phase 9.
 *
 * Renders a backend-provided DiffPreview received via the diff.preview_created
 * SSE event. Display-only: no file writes, no policy decisions.
 *
 * Architecture boundary (docs/03 §11, docs/14 §11):
 *  - TUI renders backend-provided diff data.
 *  - TUI does not apply patches, compute policy, or modify files.
 *  - Approval/denial is handled by PermissionModal, not this component.
 */
export function DiffViewer(): JSX.Element {
  const preview = currentDiffPreview();

  function handleClose(): void {
    setDiffViewerOpen(false);
    setCurrentDiffPreview(null);
  }

  return (
    <box
      position="absolute"
      top={2}
      left={4}
      width={72}
      height={24}
      border={true}
      title=" Diff Preview "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <Show when={preview !== null} fallback={<NoDiffPlaceholder />}>
        <DiffContent preview={preview!} />
      </Show>
      <box height={1} flexDirection="row" onMouseDown={handleClose}>
        <text content="  [close]" />
      </box>
    </box>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NoDiffPlaceholder(): JSX.Element {
  return (
    <box flexDirection="column" flexGrow={1}>
      <text content="No diff preview available." />
      <text content="" />
      <text content="A preview will appear here when the agent proposes a" />
      <text content="file mutation (write / edit / apply_patch)." />
    </box>
  );
}

interface DiffContentProps {
  preview: NonNullable<ReturnType<typeof currentDiffPreview>>;
}

function DiffContent({ preview }: DiffContentProps): JSX.Element {
  const lines = preview.patch.split("\n");
  // Limit lines rendered to keep the panel height-safe.
  const MAX_VISIBLE_LINES = 14;
  const visibleLines = lines.slice(0, MAX_VISIBLE_LINES);
  const truncated = lines.length > MAX_VISIBLE_LINES;

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header: file path */}
      <text content={`  File: ${preview.path}`} />
      {/* Stats line */}
      <text
        content={`  +${preview.linesAdded ?? 0} / -${preview.linesRemoved ?? 0} lines`}
      />
      <text content="" />
      {/* Diff lines */}
      <For each={visibleLines}>
        {(line) => <DiffLine line={line} />}
      </For>
      <Show when={truncated}>
        <text content={`  … (${lines.length - MAX_VISIBLE_LINES} more lines)`} />
      </Show>
    </box>
  );
}

interface DiffLineProps {
  line: string;
}

function DiffLine({ line }: DiffLineProps): JSX.Element {
  // Context or header lines are rendered as-is.
  // Added/removed lines get a prefix marker for clarity.
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <text content={line} />;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <text content={line} />;
  }
  return <text content={line} />;
}
