import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const STATE_PATH = path.resolve(import.meta.dirname, "./app.ts");
const APP_PATH = path.resolve(import.meta.dirname, "../App.tsx");
const EVENT_DISPATCHER_PATH = path.resolve(import.meta.dirname, "../lib/event-dispatcher.ts");
const TOOLBAR_PATH = path.resolve(
  import.meta.dirname,
  "../components/TopBar.tsx",
);
const APPROVAL_CARD_PATH = path.resolve(
  import.meta.dirname,
  "../components/cards/ApprovalCard.tsx",
);

const stateApp = readFileSync(STATE_PATH, "utf-8");
const appTsx = readFileSync(APP_PATH, "utf-8");
const eventDispatcherText = existsSync(EVENT_DISPATCHER_PATH) ? readFileSync(EVENT_DISPATCHER_PATH, "utf-8") : appTsx;
const topBar = readFileSync(TOOLBAR_PATH, "utf-8");
const approvalCard = readFileSync(APPROVAL_CARD_PATH, "utf-8");

describe("Phase 6 — Permission UX", () => {
  describe("State layer", () => {
    it("exports pendingApprovalCount signal", () => {
      expect(stateApp).toContain("pendingApprovalCount");
    });

    it("exports incrementPendingApprovals and decrementPendingApprovals", () => {
      expect(stateApp).toContain("export function incrementPendingApprovals");
      expect(stateApp).toContain("export function decrementPendingApprovals");
    });

    it("decrement never goes below 0", () => {
      expect(stateApp).toContain("Math.max(0, c - 1)");
    });

    it("exports fallbackMode signal", () => {
      expect(stateApp).toContain("fallbackMode");
    });
  });

  describe("TopBar", () => {
    it("imports pendingApprovalCount", () => {
      expect(topBar).toContain("pendingApprovalCount");
    });

    it("renders pending badge with count", () => {
      expect(topBar).toContain("pendingApprovalCount() > 0");
      expect(topBar).toContain("pending");
    });

    it("uses warn-soft and warn colors for badge", () => {
      expect(topBar).toContain("var(--warn-soft)");
      expect(topBar).toContain("var(--warn)");
    });
  });

  describe("handleEvent (event-dispatcher / App.tsx)", () => {
    it("increments pendingApprovalCount on permission.requested", () => {
      expect(eventDispatcherText).toContain("incrementPendingApprovals()");
    });

    it("decrements on permission.decided, denied, and expired", () => {
      expect(eventDispatcherText).toContain("decrementPendingApprovals()");
      // Count occurrences — should be 3 (decided, denied, expired)
      const matches = eventDispatcherText.match(/decrementPendingApprovals\(\)/g);
      expect(matches?.length).toBe(3);
    });

    it("tracks sequenceNumber and totalCount for stacking", () => {
      expect(eventDispatcherText).toContain("pendingApprovalCount() + 1");
      expect(eventDispatcherText).toContain("sequenceNumber: seq");
      expect(eventDispatcherText).toContain("totalCount: total");
    });

    it("auto-scrolls canvas on permission.requested", () => {
      expect(eventDispatcherText).toContain("querySelector('[role=\"log\"]')");
      expect(eventDispatcherText).toContain("scrollTop = canvas.scrollHeight");
    });

    it("renders PermissionPrompt conditionally based on fallbackMode", () => {
      expect(appTsx).toContain("permissionModalOpen() && fallbackMode()");
    });
  });

  describe("ApprovalCard", () => {
    it("handles expired status", () => {
      expect(approvalCard).toContain('"expired"');
    });

    it("disables buttons when decided", () => {
      expect(approvalCard).toContain("isDecided()");
    });

    it("calls permissions.decide with correct arguments", () => {
      expect(approvalCard).toContain('decision: allowed ? "allow" : "deny"');
    });

    it("displays risk level with color coding", () => {
      expect(approvalCard).toContain('"high"');
      expect(approvalCard).toContain('"medium"');
      expect(approvalCard).toContain("toUpperCase()");
      expect(approvalCard).toContain("var(--danger-soft)");
      expect(approvalCard).toContain("var(--warn-soft)");
      expect(approvalCard).toContain("var(--success-soft)");
    });

    it("shows sequence numbering", () => {
      expect(approvalCard).toContain("sequenceNumber");
      expect(approvalCard).toContain("totalCount");
    });
  });
});
