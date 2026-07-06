// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const CARDS_DIR = path.resolve(import.meta.dirname);

describe("Card components", () => {
  const files = ["PlanCard.tsx", "ToolActivityCard.tsx", "DiffCard.tsx", "TerminalCard.tsx", "ApprovalCard.tsx", "SummaryCard.tsx", "CardRegistry.tsx"];

  for (const file of files) {
    it(file + " exists and exports a component", () => {
      const filePath = path.join(CARDS_DIR, file);
      const content = readFileSync(filePath, "utf-8");
      expect(content).toBeTruthy();
      // Each card file should export a function component (export function X)
      expect(content).toContain("export function");
      // Each component should return JSX
      expect(content).toContain("return (");
    });
  }
});

describe("Card components — lifecycle state strings", () => {
  const planCard = readFileSync(path.join(CARDS_DIR, "PlanCard.tsx"), "utf-8");
  const toolCard = readFileSync(path.join(CARDS_DIR, "ToolActivityCard.tsx"), "utf-8");
  const terminalCard = readFileSync(path.join(CARDS_DIR, "TerminalCard.tsx"), "utf-8");
  const approvalCard = readFileSync(path.join(CARDS_DIR, "ApprovalCard.tsx"), "utf-8");

  it("PlanCard handles step status variants", () => {
    expect(planCard).toContain('"completed"');
    expect(planCard).toContain('"in_progress"');
    expect(planCard).toContain('"failed"');
  });

  it("ToolActivityCard handles lifecycle states", () => {
    expect(toolCard).toContain('"completed"');
    expect(toolCard).toContain('"failed"');
    expect(toolCard).toContain('"in_progress"');
    expect(toolCard).toContain('"aborted"');
  });

  it("TerminalCard handles status variants", () => {
    expect(terminalCard).toContain('"in_progress"');
    expect(terminalCard).toContain('"high"');
    expect(terminalCard).toContain('"medium"');
  });

  it("ApprovalCard handles all decision states", () => {
    expect(approvalCard).toContain('"approved"');
    expect(approvalCard).toContain('"denied"');
    expect(approvalCard).toContain('"expired"');
  });
});

describe("Card components — visual elements", () => {
  const planCard = readFileSync(path.join(CARDS_DIR, "PlanCard.tsx"), "utf-8");
  const toolCard = readFileSync(path.join(CARDS_DIR, "ToolActivityCard.tsx"), "utf-8");
  const diffCard = readFileSync(path.join(CARDS_DIR, "DiffCard.tsx"), "utf-8");
  const terminalCard = readFileSync(path.join(CARDS_DIR, "TerminalCard.tsx"), "utf-8");
  const approvalCard = readFileSync(path.join(CARDS_DIR, "ApprovalCard.tsx"), "utf-8");
  const summaryCard = readFileSync(path.join(CARDS_DIR, "SummaryCard.tsx"), "utf-8");

  it("PlanCard has collapsible header", () => {
    expect(planCard).toContain("aria-expanded");
  });

  it("ToolActivityCard shows pass/fail markers", () => {
    expect(toolCard).toContain("✓");
    expect(toolCard).toContain("✗");
  });

  it("DiffCard has file type tags", () => {
    expect(diffCard).toContain("Modified");
    expect(diffCard).toContain("Added");
    expect(diffCard).toContain("Removed");
  });

  it("TerminalCard has window chrome header", () => {
    expect(terminalCard).toContain("⬤ ⬤ ⬤");
    expect(terminalCard).toContain("Terminal Output");
  });

  it("ApprovalCard has approve/reject buttons", () => {
    expect(approvalCard).toContain("Approve");
    expect(approvalCard).toContain("Reject");
    expect(approvalCard).toContain("permissions.decide");
  });

  it("SummaryCard uses DOMPurify sanitization", () => {
    expect(summaryCard).toContain("DOMPurify");
    expect(summaryCard).toContain("sanitize");
  });
});

describe("MessageBubble", () => {
  const msgBubble = readFileSync(
    path.resolve(import.meta.dirname, "../MessageBubble.tsx"),
    "utf-8",
  );

  it("dispatches to CardRegistry for cardType messages", () => {
    expect(msgBubble).toContain("CardRegistry");
    expect(msgBubble).toContain("cardType");
    expect(msgBubble).toContain("cardData");
  });

  it("uses DOMPurify sanitization", () => {
    expect(msgBubble).toContain("DOMPurify");
    expect(msgBubble).toContain("sanitize");
  });

  it("renders system messages as centered italic", () => {
    expect(msgBubble).toContain('role === "system"');
  });
});

describe("CardRegistry", () => {
  const registry = readFileSync(
    path.join(CARDS_DIR, "CardRegistry.tsx"),
    "utf-8",
  );

  it("routes all 6 card types", () => {
    expect(registry).toContain('"plan"');
    expect(registry).toContain('"tool"');
    expect(registry).toContain('"diff"');
    expect(registry).toContain('"terminal"');
    expect(registry).toContain('"approval"');
    expect(registry).toContain('"summary"');
  });

  it("has a fallback for unknown types", () => {
    expect(registry).toContain("Unknown card type");
  });
});

describe("State layer — card types", () => {
  const stateApp = readFileSync(
    path.resolve(import.meta.dirname, "../../state/app.ts"),
    "utf-8",
  );

  it("exports CardStatus type with all states", () => {
    expect(stateApp).toContain('"pending"');
    expect(stateApp).toContain('"in_progress"');
    expect(stateApp).toContain('"completed"');
    expect(stateApp).toContain('"failed"');
    expect(stateApp).toContain('"aborted"');
    expect(stateApp).toContain('"approved"');
    expect(stateApp).toContain('"denied"');
    expect(stateApp).toContain('"expired"');
  });

  it("exports 6 card data interfaces", () => {
    expect(stateApp).toContain("PlanCardData");
    expect(stateApp).toContain("ToolActivityCardData");
    expect(stateApp).toContain("DiffCardData");
    expect(stateApp).toContain("TerminalCardData");
    expect(stateApp).toContain("ApprovalCardData");
    expect(stateApp).toContain("SummaryCardData");
  });

  it("exports appendCard and updateCardData helpers", () => {
    expect(stateApp).toContain("export function appendCard");
    expect(stateApp).toContain("export function updateCardData");
  });

  it("DisplayMessage has optional card fields", () => {
    expect(stateApp).toContain("cardType?");
    expect(stateApp).toContain("cardId?");
    expect(stateApp).toContain("cardData?");
  });
});
