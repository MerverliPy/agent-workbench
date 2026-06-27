/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import {
  ErrorEnvelope,
  Plan,
  PlanStatus,
  PlanStep,
  CreateSessionRequest,
  UpdateSessionRequest,
  SessionStatus,
  PermissionRequest,
  PermissionDecision,
  SubmitDecisionRequest,
  SubmitPlanDecisionRequest,
  PlanDecision,
  SubmitMessageRequest,
  ToolCall,
  ToolCallStatus,
  RunStatus,
} from "@agent-workbench/protocol";

describe("Protocol contract — ErrorEnvelope", () => {
  it("parses a valid ErrorEnvelope", () => {
    const result = ErrorEnvelope.safeParse({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "req-123",
        recoverable: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error.code).toBe("NOT_FOUND");
      expect(result.data.error.message).toBe("Route not found");
      expect(result.data.error.requestId).toBe("req-123");
      expect(result.data.error.recoverable).toBe(true);
    }
  });

  it("parses a minimal ErrorEnvelope (code + message only)", () => {
    const result = ErrorEnvelope.safeParse({
      error: { code: "INTERNAL_ERROR", message: "Boom" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an ErrorEnvelope with missing code", () => {
    const result = ErrorEnvelope.safeParse({
      error: { message: "No code" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an ErrorEnvelope with missing error wrapper", () => {
    const result = ErrorEnvelope.safeParse({
      code: "BAD", message: "Wrong shape",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-object error field", () => {
    const result = ErrorEnvelope.safeParse({ error: "string" });
    expect(result.success).toBe(false);
  });
});

describe("Protocol contract — Plan", () => {
  it("parses a valid Plan with all fields", () => {
    const result = Plan.safeParse({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sessionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      status: "draft",
      summary: "Write file x.ts",
      riskLevel: "medium",
      steps: [
        {
          order: 0,
          type: "write",
          description: "Write x.ts",
          targetPath: "src/x.ts",
          isRisky: true,
          riskLevel: "medium",
        },
      ],
      targetFiles: ["src/x.ts"],
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.steps.length).toBe(1);
      expect(result.data.targetFiles).toEqual(["src/x.ts"]);
    }
  });

  it("rejects invalid PlanStatus", () => {
    const result = Plan.safeParse({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sessionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      status: "invalid_status",
      summary: "Plan",
      riskLevel: "low",
      steps: [],
      targetFiles: [],
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("validates PlanStatus enum values", () => {
    const valid = ["draft", "pending", "approved", "denied", "executing", "completed", "failed"];
    for (const s of valid) {
      expect(PlanStatus.safeParse(s).success).toBe(true);
    }
    expect(PlanStatus.safeParse("garbage").success).toBe(false);
  });

  it("rejects PlanStep with negative order", () => {
    const result = PlanStep.safeParse({
      order: -1,
      type: "write",
      description: "Bad step",
      isRisky: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("Protocol contract — Session", () => {
  it("validates CreateSessionRequest with required fields", () => {
    const result = CreateSessionRequest.safeParse({
      projectPath: "/tmp/test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectPath).toBe("/tmp/test");
    }
  });

  it("validates CreateSessionRequest with optional title", () => {
    const result = CreateSessionRequest.safeParse({
      projectPath: "/tmp/test",
      title: "Test Session",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Test Session");
    }
  });

  it("rejects CreateSessionRequest without projectPath", () => {
    const result = CreateSessionRequest.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects CreateSessionRequest with number projectPath", () => {
    const result = CreateSessionRequest.safeParse({
      projectPath: 123,
    });
    expect(result.success).toBe(false);
  });

  it("validates UpdateSessionRequest with partial fields", () => {
    const result = UpdateSessionRequest.safeParse({
      title: "Updated Title",
    });
    expect(result.success).toBe(true);
  });

  it("validates UpdateSessionRequest with status", () => {
    const result = UpdateSessionRequest.safeParse({
      status: "archived",
    });
    expect(result.success).toBe(true);
  });

  it("rejects UpdateSessionRequest with invalid status", () => {
    const result = UpdateSessionRequest.safeParse({
      status: "running",
    });
    expect(result.success).toBe(false);
  });

  it("validates SessionStatus enum values", () => {
    const valid = ["active", "idle", "aborted", "archived", "deleted"];
    for (const s of valid) {
      expect(SessionStatus.safeParse(s).success).toBe(true);
    }
    expect(SessionStatus.safeParse("closed").success).toBe(false);
  });

  it("accepts empty UpdateSessionRequest", () => {
    const result = UpdateSessionRequest.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("Protocol contract — Permission", () => {
  it("validates SubmitDecisionRequest with allow", () => {
    const result = SubmitDecisionRequest.safeParse({
      decision: "allow",
      scope: "once",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decision).toBe("allow");
    }
  });

  it("validates SubmitDecisionRequest with deny", () => {
    const result = SubmitDecisionRequest.safeParse({
      decision: "deny",
    });
    expect(result.success).toBe(true);
  });

  it("rejects SubmitDecisionRequest with invalid decision", () => {
    const result = SubmitDecisionRequest.safeParse({
      decision: "maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects SubmitDecisionRequest without decision", () => {
    const result = SubmitDecisionRequest.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates SubmitPlanDecisionRequest", () => {
    const result = SubmitPlanDecisionRequest.safeParse({
      decision: "approve",
      reason: "Looks good",
    });
    expect(result.success).toBe(true);
  });

  it("rejects SubmitPlanDecisionRequest with invalid decision", () => {
    const result = SubmitPlanDecisionRequest.safeParse({
      decision: "maybe_later",
    });
    expect(result.success).toBe(false);
  });

  it("validates PlanDecision enum", () => {
    expect(PlanDecision.safeParse("approve").success).toBe(true);
    expect(PlanDecision.safeParse("deny").success).toBe(true);
    expect(PlanDecision.safeParse("allow").success).toBe(false);
  });
});

describe("Protocol contract — ToolCall", () => {
  it("validates ToolCallStatus enum", () => {
    const valid = ["requested", "permission_pending", "running", "completed", "failed", "denied", "aborted"];
    for (const s of valid) {
      expect(ToolCallStatus.safeParse(s).success).toBe(true);
    }
    expect(ToolCallStatus.safeParse("unknown").success).toBe(false);
  });

  it("validates RunStatus enum", () => {
    const valid = ["pending", "running", "completed", "failed", "aborted"];
    for (const s of valid) {
      expect(RunStatus.safeParse(s).success).toBe(true);
    }
    expect(RunStatus.safeParse("cancelled").success).toBe(false);
  });
});

describe("Protocol contract — Message", () => {
  it("validates SubmitMessageRequest", () => {
    const result = SubmitMessageRequest.safeParse({
      content: "Hello world",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("Hello world");
      expect(result.data.role).toBe("user");
    }
  });

  it("rejects SubmitMessageRequest with empty content", () => {
    const result = SubmitMessageRequest.safeParse({
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects SubmitMessageRequest without content", () => {
    const result = SubmitMessageRequest.safeParse({});
    expect(result.success).toBe(false);
  });
});
