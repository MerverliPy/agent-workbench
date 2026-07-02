import type { JSX } from "@opentui/solid";
import { For, Show } from "solid-js";
import { currentDiffPreview, setCurrentDiffPreview, setDiffViewerOpen } from "../../state/app";

// ANSI color codes for diff rendering
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

/**
 * Diff viewer — Phase 21 enhanced with +/- color.
 *
 * Renders a backend-provided DiffPreview received via the diff.preview_created
 * SSE event. Added lines are green, removed lines red, context lines dimmed.
 * Display-only: no file writes, no policy decisions.
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
      width={76}
      height={24}
      border={true}
      title=" Diff Preview  [Esc to close] "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <Show when={preview !== null} fallback={<NoDiffPlaceholder />}>
        <DiffContent preview={preview!} />
      </Show>
      <box height={1} flexDirection="row" onMouseDown={handleClose}>
        <text content="  [close]  — use Arrow keys to scroll" />
      </box>
    </box>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

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
  const MAX_LINES = 14;
  const visible = lines.slice(0, MAX_LINES);
  const truncated = lines.length > MAX_LINES;

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <text content={`${CYAN}File: ${preview.path}${RESET}`} />
      <text
        content={`${GREEN}+${preview.linesAdded ?? 0}${RESET} ${RED}-${preview.linesRemoved ?? 0}${RESET} lines`}
      />
      <text content="" />
      {/* Diff lines with color */}
      <For each={visible}>{(line) => <DiffLine line={line} />}</For>
      <Show when={truncated}>
        <text
          content={`${DIM}… (${lines.length - MAX_LINES} more lines)${RESET}`}
        />
      </Show>
    </box>
  );
}

interface DiffLineProps {
  line: string;
}

function DiffLine({ line }: DiffLineProps): JSX.Element {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <text content={`${GREEN}${line}${RESET}`} />;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <text content={`${RED}${line}${RESET}`} />;
  }
  if (line.startsWith("@@")) {
    return <text content={`${CYAN}${line}${RESET}`} />;
  }
  return <text content={`${DIM}${line}${RESET}`} />;
}
