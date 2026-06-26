/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { validatePlan, computePlanRiskLevel, hasMutationSteps, hasRiskySteps } from "@agent-workbench/planner";
import type { Plan, PlanStep } from "@agent-workbench/protocol";

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    type: "read",
    order: 0,
    description: "Read file",
    isRisky: false,
    ...overrides,
  };
}

function makePlan(partial: Partial<Plan> = {}): Plan {
  return {
    id: "plan_01",
    sessionId: "s1",
    runId: "r1",
    status: "pending",
    summary: "A valid plan",
    riskLevel: "low",
    steps: [],
    targetFiles: [],
    approvalPolicy: "ask",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("validatePlan", () => {
  it("accepts a valid plan with steps", () => {
    const plan = makePlan({
      steps: [makeStep({ order: 1, description: "Read foo.ts" })],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty steps", () => {
    const plan = makePlan({ steps: [] });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("at least one step");
  });

  it("rejects invalid status", () => {
    const plan = makePlan({
      status: "invalid" as any,
      steps: [makeStep({ order: 1 })],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid plan status");
  });

  it("rejects mutation step without targetPath", () => {
    const plan = makePlan({
      steps: [
        makeStep({ order: 1, type: "write", description: "Write file" }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("targetPath");
  });

  it("accepts mutation step with targetPath", () => {
    const plan = makePlan({
      steps: [
        makeStep({
          order: 1,
          type: "write",
          description: "Write foo.ts",
          targetPath: "foo.ts",
          isRisky: true,
          riskLevel: "high",
        }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
  });

  it("rejects risky step without riskLevel", () => {
    const plan = makePlan({
      steps: [
        makeStep({
          order: 1,
          type: "shell",
          description: "Run command",
          command: "ls",
          isRisky: true,
        }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("riskLevel");
  });

  it("rejects non-ascending step order", () => {
    const plan = makePlan({
      steps: [
        makeStep({ order: 3, description: "Step 3" }),
        makeStep({ order: 1, description: "Step 1" }),
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("ascending");
  });

  it("rejects empty summary", () => {
    const plan = makePlan({
      summary: "   ",
      steps: [makeStep({ order: 1 })],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("empty");
  });
});

describe("computePlanRiskLevel", () => {
  it("returns low for empty steps", () => {
    expect(computePlanRiskLevel([])).toBe("low");
  });

  it("returns max risk across steps", () => {
    const steps = [
      { ...makeStep({ order: 1 }), riskLevel: "low" as const },
      { ...makeStep({ order: 2 }), riskLevel: "high" as const },
      { ...makeStep({ order: 3 }), riskLevel: "medium" as const },
    ];
    expect(computePlanRiskLevel(steps)).toBe("high");
  });

  it("returns critical when present", () => {
    const steps = [
      { ...makeStep({ order: 1 }), riskLevel: "low" as const },
      { ...makeStep({ order: 2 }), riskLevel: "critical" as const },
    ];
    expect(computePlanRiskLevel(steps)).toBe("critical");
  });

  it("defaults missing risk levels to low", () => {
    const steps = [makeStep({ order: 1 })];
    expect(computePlanRiskLevel(steps)).toBe("low");
  });
});

describe("hasMutationSteps", () => {
  it("returns false for read-only steps", () => {
    expect(hasMutationSteps([makeStep({ type: "read" })])).toBe(false);
    expect(hasMutationSteps([makeStep({ type: "shell" })])).toBe(false);
  });

  it("returns true for write/edit/patch/delete steps", () => {
    expect(hasMutationSteps([makeStep({ type: "write" })])).toBe(true);
    expect(hasMutationSteps([makeStep({ type: "edit" })])).toBe(true);
    expect(hasMutationSteps([makeStep({ type: "patch" })])).toBe(true);
    expect(hasMutationSteps([makeStep({ type: "delete" })])).toBe(true);
  });
});

describe("hasRiskySteps", () => {
  it("returns true for mutation and shell steps", () => {
    expect(hasRiskySteps([makeStep({ type: "shell" })])).toBe(true);
    expect(hasRiskySteps([makeStep({ type: "write" })])).toBe(true);
    expect(hasRiskySteps([makeStep({ type: "delete" })])).toBe(true);
  });

  it("returns false for read-only steps", () => {
    expect(hasRiskySteps([makeStep({ type: "read" })])).toBe(false);
  });
});
