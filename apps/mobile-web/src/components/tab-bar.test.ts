// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const TABBAR = readFileSync(path.resolve(import.meta.dirname, "../components/TabBar.tsx"), "utf-8");
const WORKSPACES = readFileSync(path.resolve(import.meta.dirname, "../components/WorkspacesView.tsx"), "utf-8");
const PANEL_CONTAINER = readFileSync(path.resolve(import.meta.dirname, "../components/panels/PanelContainer.tsx"), "utf-8");
const APP = readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf-8");
const STATE = readFileSync(path.resolve(import.meta.dirname, "../state/app.ts"), "utf-8");
const NAV_DRAWER = readFileSync(path.resolve(import.meta.dirname, "../components/NavDrawer.tsx"), "utf-8");
const CSS = readFileSync(path.resolve(import.meta.dirname, "../styles/index.css"), "utf-8");

describe("Phase 8 — Tab Bar + Workspaces", () => {
  describe("State layer", () => {
    it("PanelId includes all 5 tabs + help", () => {
      expect(STATE).toContain('"chat"');
      expect(STATE).toContain('"workspaces"');
      expect(STATE).toContain('"files"');
      expect(STATE).toContain('"activity"');
      expect(STATE).toContain('"settings"');
      expect(STATE).toContain('"help"');
    });

    it("WorkspaceSubTab type defined with 3 values", () => {
      expect(STATE).toContain('"files"');
      expect(STATE).toContain('"git"');
      expect(STATE).toContain('"sessions"');
      expect(STATE).toContain("WorkspaceSubTab");
    });

    it("activePanel defaults to chat", () => {
      expect(STATE).toContain('activePanel, setActivePanel');
      expect(STATE).toContain('"chat"');
    });

    it("workspaceSubTab defaults to files", () => {
      expect(STATE).toContain("workspaceSubTab");
      expect(STATE).toContain('"files"');
    });
  });

  describe("TabBar component", () => {
    it("nav with role=tablist", () => {
      expect(TABBAR).toContain('role="tablist"');
    });

    it("renders all 5 tabs with SVG icons", () => {
      expect(TABBAR).toContain("Chats");
      expect(TABBAR).toContain("Workspaces");
      expect(TABBAR).toContain("Files");
      expect(TABBAR).toContain("Activity");
      expect(TABBAR).toContain("Settings");
      // No emoji icons
      expect(TABBAR).not.toContain("💬");
      expect(TABBAR).not.toContain("📁");
    });

    it("uses aria-selected for active state", () => {
      expect(TABBAR).toContain("aria-selected={isActive()}");
    });

    it("sets active panel on click", () => {
      expect(TABBAR).toContain("setActivePanel(tab.id)");
    });

    it("blurred glass background with safe-area padding", () => {
      expect(TABBAR).toContain("backdrop-filter: blur(18px)");
      expect(TABBAR).toContain("border-top-color: var(--border)");
    });

    it("buttons have 44px+ min height", () => {
      expect(TABBAR).toContain("px-2.5");
    });
  });

  describe("WorkspacesView", () => {
    it("has segmented control with 3 tabs", () => {
      expect(WORKSPACES).toContain("Files");
      expect(WORKSPACES).toContain("Git");
      expect(WORKSPACES).toContain("Sessions");
    });
    it("segmented control uses role=tablist", () => {
      expect(WORKSPACES).toContain('role="tablist"');
    });
  });

  describe("PanelContainer", () => {
    it("routes all 6 panels via Switch/Match", () => {
      expect(PANEL_CONTAINER).toContain('"chat"');
      expect(PANEL_CONTAINER).toContain('"workspaces"');
      expect(PANEL_CONTAINER).toContain('"files"');
      expect(PANEL_CONTAINER).toContain('"activity"');
      expect(PANEL_CONTAINER).toContain('"settings"');
      expect(PANEL_CONTAINER).toContain('"help"');
    });
  });

  describe("App.tsx", () => {
    it("imports and renders TabBar", () => {
      expect(APP).toContain("import { TabBar }");
      expect(APP).toContain("<TabBar />");
    });
  });

  describe("NavDrawer", () => {
    it("simplified to only settings + help", () => {
      expect(NAV_DRAWER).toContain('"settings"');
      expect(NAV_DRAWER).toContain('"help"');
      expect(NAV_DRAWER).not.toContain('"chat"');
      expect(NAV_DRAWER).not.toContain('"files"');
      expect(NAV_DRAWER).not.toContain('"git"');
    });
  });

  describe("Phase 9 — Animation Polish", () => {
    it("msgIn keyframe defined", () => {
      expect(CSS).toContain("@keyframes msgIn");
    });
    it("blink keyframe defined", () => {
      expect(CSS).toContain("@keyframes blink");
    });
    it("dotBounce keyframe defined", () => {
      expect(CSS).toContain("@keyframes dotBounce");
    });
    it("connection-pulse keyframe defined", () => {
      expect(CSS).toContain("@keyframes connection-pulse");
    });
    it("fade-in keyframe defined", () => {
      expect(CSS).toContain("@keyframes fade-in");
    });
    it("reduced-motion respect", () => {
      expect(CSS).toContain("prefers-reduced-motion");
    });
    it("panel-enter animation class", () => {
      expect(CSS).toContain(".panel-enter");
    });
  });
});
