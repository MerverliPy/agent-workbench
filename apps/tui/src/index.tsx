import { render } from "@opentui/solid";
import { App } from "./App";

/**
 * TUI entry point.
 *
 * Starts the OpenTUI renderer with the App component.
 * exitOnCtrlC: true — Ctrl+C exits the process cleanly.
 *
 * Prerequisite: start the local server first:
 *   cd apps/server && bun run start
 *
 * Then run the TUI:
 *   cd apps/tui && bun run start
 */
await render(() => <App />, {
  exitOnCtrlC: true,
  clearOnShutdown: true,
});
