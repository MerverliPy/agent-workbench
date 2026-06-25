import type { JSX } from "@opentui/solid";
import { setTokenHealthOpen } from "../../state/app";

/**
 * Token health panel — Phase 4 placeholder.
 *
 * In Phase 12, this panel will display:
 *   - Health status (ok / warning / critical)
 *   - Estimated context usage and remaining budget
 *   - Largest context contributors
 *   - Truncated tool output indicators
 *   - Summary state and compaction suggestion
 *
 * Token health state comes from SSE token_health.updated events emitted by
 * packages/tokens. No token budget calculation lives in the TUI.
 *
 * Phase 4: renders a placeholder notice only.
 */
export function TokenHealthPanel(): JSX.Element {
  return (
    <box
      position="absolute"
      top={4}
      left={8}
      width={56}
      height={10}
      border={true}
      title=" Token Health "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text content="[Phase 4 placeholder — Token Health]" />
      <text content="" />
      <text content="Token health monitoring is a Phase 12 feature." />
      <text content="Context budget, compaction suggestions, and usage" />
      <text content="details will appear here in Phase 12." />
      <text content="" />
      <box
        height={1}
        flexDirection="row"
        onMouseDown={() => setTokenHealthOpen(false)}
      >
        <text content="  [close]" />
      </box>
    </box>
  );
}
