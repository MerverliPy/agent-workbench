import type {
  Plan,
  PlanStatus,
  PlanStep,
  RiskLevel,
} from "@agent-workbench/protocol";

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_STATUSES = new Set<PlanStatus>([
  "draft",
  "pending",
  "approved",
  "denied",
  "executing",
  "completed",
  "failed",
]);

const MUTATION_STEP_TYPES = new Set(["write", "edit", "patch", "delete"]);

const RISKY_STEP_TYPES = new Set(["write", "edit", "patch", "delete", "shell"]);

export function validatePlan(plan: Plan): PlanValidationResult {
  const errors: string[] = [];

  if (plan.steps.length === 0) {
    errors.push("Plan must have at least one step.");
  }

  if (!VALID_STATUSES.has(plan.status)) {
    errors.push(`Invalid plan status: ${plan.status}`);
  }

  const mutableSteps = plan.steps.filter((s) =>
    MUTATION_STEP_TYPES.has(s.type),
  );
  for (const step of mutableSteps) {
    if (step.targetPath === undefined || step.targetPath.trim().length === 0) {
      errors.push(
        `Mutation step ${step.order} ("${step.description}") must identify a targetPath.`,
      );
    }
  }

  for (const step of plan.steps) {
    if (step.isRisky && step.riskLevel === undefined) {
      errors.push(
        `Risky step ${step.order} ("${step.description}") must specify a riskLevel.`,
      );
    }
  }

  for (let i = 1; i < plan.steps.length; i++) {
    const prev = plan.steps[i - 1];
    const curr = plan.steps[i];
    if (prev !== undefined && curr !== undefined && curr.order <= prev.order) {
      errors.push(
        `Plan steps must be in ascending order (found ${prev.order} then ${curr.order}).`,
      );
    }
  }

  if (plan.summary.trim().length === 0) {
    errors.push("Plan summary must not be empty.");
  }

  return { valid: errors.length === 0, errors };
}

export function computePlanRiskLevel(steps: PlanStep[]): RiskLevel {
  const order: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  let max: RiskLevel = "low";
  for (const step of steps) {
    const level = step.riskLevel ?? "low";
    if (order[level] > order[max]) {
      max = level;
    }
  }
  return max;
}

export function hasMutationSteps(steps: PlanStep[]): boolean {
  return steps.some((s) => MUTATION_STEP_TYPES.has(s.type));
}

export function hasRiskySteps(steps: PlanStep[]): boolean {
  return steps.some((s) => RISKY_STEP_TYPES.has(s.type));
}
