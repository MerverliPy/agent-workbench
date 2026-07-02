/**
 * PTY terminal resize event handling.
 *
 * Terminal resize events (SIGWINCH) must be propagated to the child
 * PTY process so that interactive programs (vim, less, tmux) can
 * reflow their output correctly.
 */
export interface PtySize {
  columns: number;
  rows: number;
}

export const DEFAULT_PTY_SIZE: PtySize = {
  columns: 80,
  rows: 24,
};

/** Callback invoked when the terminal window is resized. */
export type PtyResizeHandler = (size: PtySize) => void;

/**
 * Creates a resize handler that forwards SIGWINCH-equivalent signals
 * to the child PTY process via stdin escape sequences or `stty` calls.
 *
 * For Bun's script-based PTY, resize is sent by writing the new
 * dimensions to the child's stdin using ANSI escape codes.
 */
export function createPtyResizeHandler(
  writeToStdin: (data: string) => void,
): PtyResizeHandler {
  return (size: PtySize) => {
    // Send resize via ANSI escape sequence that the PTY understands
    writeToStdin(`\x1b[8;${size.rows};${size.columns}t`);
  };
}

/**
 * Build the `stty` command prefix to set terminal dimensions before
 * running the actual command. Used with `script`-based PTY.
 */
export function buildSttySizeFlags(size: PtySize): string {
  return `stty rows ${size.rows} cols ${size.columns}; `;
}
