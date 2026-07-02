/**
 * Ring buffer for PTY terminal output with configurable scrollback.
 *
 * PTY output can be enormous (megabytes/second for commands like `cat`).
 * This buffer keeps only the most recent N lines/chunks, discarding the
 * oldest when capacity is exceeded.
 */
export class PtyOutputBuffer {
  private buffer: string[] = [];
  private totalBytes = 0;

  /** Maximum number of lines to retain (default ~1000 lines). */
  readonly maxLines: number;
  /** Maximum total bytes to retain (default 1MB). */
  readonly maxBytes: number;

  constructor(options?: { maxLines?: number; maxBytes?: number }) {
    this.maxLines = options?.maxLines ?? 1000;
    this.maxBytes = options?.maxBytes ?? 1_000_000;
  }

  /** Append a line (or chunk) to the buffer, evicting old entries. */
  append(chunk: string): void {
    const lines = chunk.split("\n");
    for (const line of lines) {
      const bytes = Buffer.byteLength(line, "utf-8");
      this.buffer.push(line);
      this.totalBytes += bytes;

      // Evict oldest entries
      while (
        this.buffer.length > this.maxLines ||
        this.totalBytes > this.maxBytes
      ) {
        const removed = this.buffer.shift();
        if (removed !== undefined) {
          this.totalBytes -= Buffer.byteLength(removed, "utf-8");
        }
      }
    }
  }

  /** Get the full buffered content as a string (max 100KB for display). */
  snapshot(maxOutputBytes = 100_000): string {
    const joined = this.buffer.join("\n");
    if (joined.length <= maxOutputBytes) return joined;
    return (
      `… (${joined.length - maxOutputBytes} more bytes trimmed)\n` +
      joined.slice(-maxOutputBytes)
    );
  }

  /** Get all lines as an array (for UI rendering). */
  lines(): readonly string[] {
    return this.buffer;
  }

  /** Total number of lines currently buffered. */
  get lineCount(): number {
    return this.buffer.length;
  }

  /** Total bytes currently buffered. */
  get byteCount(): number {
    return this.totalBytes;
  }

  /** Clear the buffer. */
  clear(): void {
    this.buffer = [];
    this.totalBytes = 0;
  }
}
