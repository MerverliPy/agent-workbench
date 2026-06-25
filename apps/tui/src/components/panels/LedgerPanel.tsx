import type { JSX } from "@opentui/solid";
import { setLedgerPanelOpen } from "../../state/app";

/**
 * Run ledger panel — Phase 4 placeholder.
 *
 * In Phase 6+, this panel will display:
 *   - Model calls (started / completed)
 *   - Tool calls (requested / started / completed)
 *   - Permission requests and decisions
 *   - Diff previews and file mutations
 *   - Shell commands
 *   - Token health events
 *   - Cache hits / misses
 *
 * Ledger entries come from SSE events emitted by packages/core.
 * No ledger persistence logic lives in the TUI.
 *
 * Phase 4: renders a placeholder notice only.
 */
export function LedgerPanel(): JSX.Element {
  return (
    <box
      position="absolute"
      top={4}
      left={8}
      width={56}
      height={10}
      border={true}
      title=" Run Ledger "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text content="[Phase 4 placeholder — Run Ledger]" />
      <text content="" />
      <text content="The run ledger is a Phase 6 feature." />
      <text content="Tool calls, model calls, and other runtime events" />
      <text content="will appear here once the core runtime is connected." />
      <text content="" />
      <box
        height={1}
        flexDirection="row"
        onMouseDown={() => setLedgerPanelOpen(false)}
      >
        <text content="  [close]" />
      </box>
    </box>
  );
}
