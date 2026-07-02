/**
 * Panel plugin extension interface.
 *
 * Plugins can add custom panels to the TUI and mobile-web UIs.
 * Each panel is a SolidJS component rendered in the appropriate surface.
 *
 * NOTE: This interface defines the contract, but the actual JSX component
 * type depends on the rendering surface (TUI uses a different JSX runtime
 * than mobile-web). Plugins export factory functions that return the
 * appropriate component for each surface.
 */

/** Panel metadata and factory. */
export interface PluginPanel {
  /** Unique panel ID (e.g. "github.pr_list"). */
  readonly id: string;
  /** Display name shown in navigation. */
  readonly title: string;
  /** Icon identifier (material icon name or SVG path). */
  readonly icon: string;
  /** Which surfaces this panel supports. */
  readonly surfaces: PanelSurface[];
  /** Whether the panel requires authentication. */
  readonly requiresAuth: boolean;
  /** Default width/height hints for the panel. */
  readonly defaultSize?: PanelSize;
}

export type PanelSurface = "tui" | "mobile-web" | "dashboard";

export interface PanelSize {
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
}

/** Interface that panel plugins must export as their default export. */
export interface PanelPlugin {
  /** Plugin metadata. */
  readonly name: string;
  readonly version: string;
  /** Panels provided by this plugin. */
  readonly panels: PluginPanel[];
}
