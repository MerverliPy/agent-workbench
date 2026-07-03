import type {
  PermissionEngine,
  PermissionGate,
} from "@agent-workbench/permissions";
import { computePlanRiskLevel, validatePlan } from "@agent-workbench/planner";
import type { Plan, PlanStep } from "@agent-workbench/protocol";
import type { PlanRepository } from "@agent-workbench/storage";
import { ulid } from "ulid";
import type { EventPublisher } from "./event-publisher";
import type { RunLedger } from "./run-ledger";

const MUTATION_TOOL_TO_STEP_TYPE: Record<string, PlanStep["type"]> = {
  write: "write",
  edit: "edit",
  apply_patch: "patch",
  revert_last_change: "edit",
};

const MUTATION_TOOL_NAMES = new Set(Object.keys(MUTATION_TOOL_TO_STEP_TYPE));
const SHELL_TOOL_NAMES = new Set(["bash"]);

export function isMutationTool(name: string): boolean {
  return MUTATION_TOOL_NAMES.has(name);
}

export function isShellTool(name: string): boolean {
  return SHELL_TOOL_NAMES.has(name);
}

export function isMutationOrRisky(name: string): boolean {
  return isMutationTool(name) || isShellTool(name);
}

export class PlanGate {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly permissionEngine: PermissionEngine,
    private readonly permissionGate: PermissionGate,
  ) {}

  buildPlan(
    sessionId: string,
    runId: string,
    calls: Array<{
      toolName: string;
      targetPath?: string;
      command?: string;
      description: string;
    }>,
    summary: string,
    targetFiles: string[],
  ): Plan {
    const now = new Date().toISOString();

    const steps: PlanStep[] = calls.map((call, i) => ({
      order: i,
      type: MUTATION_TOOL_TO_STEP_TYPE[call.toolName] ?? "shell",
      description: call.description,
      targetPath: call.targetPath,
      command: call.command,
      isRisky: true,
      riskLevel: "high" as const,
    }));

    return {
      id: ulid(),
      sessionId,
      runId,
      status: "draft",
      summary,
      riskLevel: computePlanRiskLevel(steps),
      steps,
      targetFiles,
      createdAt: now,
      metadata: {},
    };
  }

  async gate(
    plan: Plan,
    events: EventPublisher,
    ledger: RunLedger,
    signal: AbortSignal,
    agentId?: string,
  ): Promise<"proceed" | "blocked"> {
    const validation = validatePlan(plan);
    if (!validation.valid) {
      const reason = validation.errors.join("; ");
      ledger.recordPlanFailed(plan.id, reason);
      events.publishPlanFailed(plan.id, reason);
      return "blocked";
    }

    const planPermReqId = ulid();
    const pendingPlan: Plan = {
      ...plan,
      status: "pending",
      permissionRequestId: planPermReqId,
    };
    this.persistPlan(pendingPlan);

    events.publishPlanProposed(pendingPlan);
    ledger.recordPlanProposed(
      pendingPlan.id,
      pendingPlan.summary,
      pendingPlan.riskLevel,
    );

    const evalResult = this.permissionEngine.evaluatePlan(
      pendingPlan.steps,
      agentId,
    );

    if (evalResult.outcome === "deny") {
      const deniedPlan: Plan = { ...pendingPlan, status: "denied" };
      this.persistPlan(deniedPlan);
      ledger.recordPlanDenied(plan.id, evalResult.reason);
      events.publishPlanDenied(plan.id, evalResult.reason);
      return "blocked";
    }

    if (evalResult.outcome === "ask") {
      const decision = await this.permissionGate.waitForDecision(
        planPermReqId,
        signal,
      );

      if (signal.aborted || decision === "deny") {
        const deniedPlan: Plan = { ...pendingPlan, status: "denied" };
        this.persistPlan(deniedPlan);
        ledger.recordPlanDenied(plan.id, "Plan denied by user.");
        events.publishPlanDenied(plan.id, "Plan denied by user.");
        return "blocked";
      }
    }

    const approvedPlan: Plan = {
      ...pendingPlan,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };
    this.persistPlan(approvedPlan);
    ledger.recordPlanApproved(plan.id);
    events.publishPlanApproved(plan.id);
    return "proceed";
  }

  private persistPlan(plan: Plan): void {
    const existing = this.planRepository.findById(plan.id);
    if (existing !== undefined) {
      this.planRepository.update(plan.id, {
        status: plan.status,
        stepsJson: JSON.stringify(plan.steps),
        targetFilesJson: JSON.stringify(plan.targetFiles),
        permissionRequestId: plan.permissionRequestId ?? null,
        approvalPolicy: plan.approvalPolicy ?? null,
        approvedAt: plan.approvedAt ?? null,
        completedAt: plan.completedAt ?? null,
      });
      return;
    }
    this.planRepository.create({
      id: plan.id,
      sessionId: plan.sessionId,
      runId: plan.runId ?? null,
      status: plan.status,
      summary: plan.summary,
      riskLevel: plan.riskLevel,
      stepsJson: JSON.stringify(plan.steps),
      targetFilesJson: JSON.stringify(plan.targetFiles),
      permissionRequestId: plan.permissionRequestId ?? null,
      approvalPolicy: plan.approvalPolicy ?? null,
      createdAt: plan.createdAt,
      approvedAt: plan.approvedAt ?? null,
      completedAt: plan.completedAt ?? null,
    });
  }
}
