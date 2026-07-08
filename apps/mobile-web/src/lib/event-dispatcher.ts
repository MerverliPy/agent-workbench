import type { EventEnvelope, PermissionRequest } from "@agent-workbench/protocol";
import { categorizeEvent, getCategoryIcon } from "./events";
import {
  appendActivity,
  appendCard,
  appendMessage,
  appendStreamingDelta,
  appendSystemNotice,
  beginStreaming,
  cancelStreaming,
  decrementPendingApprovals,
  finalizeStreaming,
  incrementPendingApprovals,
  pendingApprovalCount,
  setCurrentAgentId,
  setPendingPermissionRequest,
  setPermissionModalOpen,
  setThinkingIndicator,
  streamingContent,
  updateCardData,
} from "../state/app";

export function handleEvent(event: EventEnvelope): void {
  const type = event.type;
  const cat = categorizeEvent(type);
  const p = event.payload as Record<string, unknown>;

  // Log all non-stream events to activity log
  if (cat !== "stream" && cat !== "other") {
    appendActivity({
      id: event.id,
      timestamp: event.timestamp,
      category: cat,
      icon: getCategoryIcon(cat),
      summary: `${type} — ${JSON.stringify(p).slice(0, 100)}`,
    });
  }

  // ── Run lifecycle ──
  if (type === "run.started") {
    setThinkingIndicator(true);
    return;
  }
  if (type === "run.completed") {
    setThinkingIndicator(false);
    return;
  }

  // ── Messages ──
  if (type === "message.created" || type === "message.delta") {
    const role = (p.role as string | undefined) ?? "assistant";
    const content = (p.content as string | undefined) ?? "";
    if (content) {
      appendMessage({
        id: event.id,
        role: role as "user" | "assistant" | "system",
        content,
        createdAt: event.timestamp,
      });
    }
    return;
  }

  // ── Streaming ──
  if (type === "model.stream_delta") {
    const delta = p.delta as string | undefined;
    if (delta) {
      if (!streamingContent()) beginStreaming(event.id);
      appendStreamingDelta(delta);
    }
    return;
  }

  if (type === "model.stream_complete") {
    finalizeStreaming();
    setThinkingIndicator(false);
    return;
  }

  if (type === "model.stream_error") {
    appendSystemNotice(`Stream error: ${(p.message as string) ?? "unknown"}`);
    cancelStreaming();
    setThinkingIndicator(false);
    return;
  }

  // ── Plan events → PlanCard + SummaryCard ──
  if (type === "plan.proposed") {
    const planPayload = p.plan as Record<string, unknown> | undefined;
    const steps =
      (planPayload?.steps as Array<Record<string, unknown>>) ?? [];
    const planId = (planPayload?.id as string) ?? event.id;
    appendCard("plan", planId, "planId", {
      planId,
      steps: steps.map((s, i) => ({
        number: (s.number as number) ?? i + 1,
        description: (s.description as string) ?? (s.summary as string) ?? "",
        status: "pending" as const,
      })),
      status: "in_progress" as const,
    });
    return;
  }

  if (type === "plan.step_started") {
    const stepIdx = (p.stepIndex as number) ?? (p.step as number) ?? 0;
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("steps" in data) {
        const steps = (data as { steps: Array<{ status: string }> }).steps;
        if (steps[stepIdx]) steps[stepIdx].status = "in_progress";
      }
    });
    return;
  }

  if (type === "plan.step_completed") {
    const stepIdx = (p.stepIndex as number) ?? (p.step as number) ?? 0;
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("steps" in data) {
        const steps = (data as { steps: Array<{ status: string }> }).steps;
        if (steps[stepIdx]) steps[stepIdx].status = "completed";
      }
    });
    return;
  }

  if (type === "plan.step_failed") {
    const stepIdx = (p.stepIndex as number) ?? (p.step as number) ?? 0;
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("steps" in data) {
        const steps = (data as { steps: Array<{ status: string }> }).steps;
        if (steps[stepIdx]) steps[stepIdx].status = "failed";
      }
    });
    return;
  }

  if (type === "plan.approved") {
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("status" in data) (data as { status: string }).status = "approved";
    });
    return;
  }

  if (type === "plan.denied") {
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("status" in data) (data as { status: string }).status = "denied";
    });
    return;
  }

  if (type === "plan.completed") {
    const planId = (p.planId as string) ?? "";
    updateCardData(planId, (data) => {
      if ("status" in data) (data as { status: string }).status = "completed";
    });
    appendSystemNotice("Plan completed");
    return;
  }

  // ── Tool events → ToolActivityCard ──
  if (type === "tool.requested") {
    const toolCallId = (p.toolCallId as string) ?? event.id;
    const toolName =
      (p.toolName as string) ?? (p.name as string) ?? "unknown";
    appendCard("tool", toolCallId, "toolCallId", {
      toolCallId,
      toolName,
      status: "pending" as const,
    });
    return;
  }

  if (type === "tool.started") {
    const toolCallId = (p.toolCallId as string) ?? "";
    updateCardData(toolCallId, (data) => {
      if ("status" in data)
        (data as { status: string }).status = "in_progress";
    });
    return;
  }

  if (type === "tool.completed") {
    const toolCallId = (p.toolCallId as string) ?? "";
    const result = (p.result as string) ?? (p.summary as string) ?? "";
    updateCardData(toolCallId, (data) => {
      const d = data as { status: string; result?: string };
      d.status = "completed";
      if (result) d.result = result;
    });
    return;
  }

  if (type === "tool.failed") {
    const toolCallId = (p.toolCallId as string) ?? "";
    const error =
      (p.error as string) ?? (p.message as string) ?? "Tool failed";
    updateCardData(toolCallId, (data) => {
      const d = data as { status: string; error?: string };
      d.status = "failed";
      d.error = error;
    });
    return;
  }

  if (type === "tool.aborted") {
    const toolCallId = (p.toolCallId as string) ?? "";
    updateCardData(toolCallId, (data) => {
      if ("status" in data) (data as { status: string }).status = "aborted";
    });
    return;
  }

  // ── Shell events → TerminalCard ──
  if (type === "shell.command_started") {
    const sessionId = (p.sessionId as string) ?? (p.id as string) ?? event.id;
    const command =
      (p.command as string) ?? (p.normalized as string) ?? "unknown";
    appendCard("terminal", sessionId, "sessionId", {
      sessionId,
      command,
      output: "",
      status: "in_progress" as const,
    });
    return;
  }

  if (type === "shell.output_chunk") {
    const sessionId = (p.sessionId as string) ?? "";
    const chunk =
      (p.chunk as string) ?? (p.data as string) ?? (p.output as string) ?? "";
    if (sessionId && chunk) {
      updateCardData(sessionId, (data) => {
        const d = data as { output: string };
        d.output += chunk;
      });
    }
    return;
  }

  if (type === "shell.command_completed") {
    const sessionId = (p.sessionId as string) ?? "";
    const exitCode = p.exitCode as number | undefined;
    updateCardData(sessionId, (data) => {
      const d = data as { status: string; exitCode?: number };
      d.status = "completed";
      if (exitCode !== undefined) d.exitCode = exitCode;
    });
    return;
  }

  if (type === "shell.command_failed") {
    const sessionId = (p.sessionId as string) ?? "";
    const error = (p.error as string) ?? "Command failed";
    updateCardData(sessionId, (data) => {
      const d = data as { status: string; error?: string };
      d.status = "failed";
      d.error = error;
    });
    return;
  }

  if (type === "shell.command_aborted") {
    const sessionId = (p.sessionId as string) ?? "";
    updateCardData(sessionId, (data) => {
      if ("status" in data) (data as { status: string }).status = "aborted";
    });
    return;
  }

  if (type === "shell.command_risk_classified") {
    const sessionId = (p.sessionId as string) ?? "";
    const riskLevel = (p.riskLevel as string) ?? "";
    if (sessionId && riskLevel) {
      updateCardData(sessionId, (data) => {
        (data as { riskLevel?: string }).riskLevel = riskLevel;
      });
    }
    return;
  }

  // ── Diff/File events → DiffCard ──
  if (type === "diff.preview_created") {
    const diffPayload = p.diff as Record<string, unknown> | undefined;
    const files =
      (diffPayload?.files as Array<Record<string, unknown>>) ??
      (p.files as Array<Record<string, unknown>>) ??
      [];
    const diffId = (diffPayload?.id as string) ?? event.id;
    appendCard("diff", diffId, null, {
      files: files.map((f) => {
        const entry: {
          path: string;
          type: "modified" | "added" | "removed";
          diff?: string;
        } = {
          path: (f.path as string) ?? (f.file as string) ?? "",
          type: ((f.type as string) ?? "modified") as
            | "modified"
            | "added"
            | "removed",
        };
        const diff = f.diff as string | undefined;
        if (diff) entry.diff = diff;
        return entry;
      }),
      status: "completed" as const,
    });
    return;
  }

  if (type === "file.change_applied") {
    const path = (p.path as string) ?? "";
    appendSystemNotice(`File changed: ${path}`);
    return;
  }

  if (type === "file.change_failed" || type === "file.revert_failed") {
    appendSystemNotice(`File error: ${(p.error as string) ?? "unknown"}`);
    return;
  }

  // ── Permissions → ApprovalCard ──
  if (type === "permission.requested") {
    const req = p.permissionRequest as PermissionRequest | undefined;
    if (req) {
      const total = pendingApprovalCount() + 1;
      const seq = total;
      setPendingPermissionRequest(req);
      setPermissionModalOpen(true);
      incrementPendingApprovals();
      appendCard("approval", req.id, "requestId", {
        requestId: req.id,
        toolName: req.toolName,
        riskLevel: (req.riskLevel as "low" | "medium" | "high") ?? "medium",
        status: "pending" as const,
        sequenceNumber: seq,
        totalCount: total,
      });
      queueMicrotask(() => {
        const canvas = document.querySelector('[role="log"]');
        if (canvas) canvas.scrollTop = canvas.scrollHeight;
      });
    }
    return;
  }

  if (type === "permission.decided") {
    const requestId = (p.requestId as string) ?? (p.id as string) ?? "";
    if (requestId) {
      decrementPendingApprovals();
      updateCardData(requestId, (data) => {
        if ("status" in data)
          (data as { status: string }).status = "approved";
      });
    }
    return;
  }

  if (type === "permission.denied") {
    const requestId = (p.requestId as string) ?? (p.id as string) ?? "";
    if (requestId) {
      decrementPendingApprovals();
      updateCardData(requestId, (data) => {
        if ("status" in data) (data as { status: string }).status = "denied";
      });
    }
    return;
  }

  if (type === "permission.expired") {
    const requestId = (p.requestId as string) ?? (p.id as string) ?? "";
    if (requestId) {
      decrementPendingApprovals();
      updateCardData(requestId, (data) => {
        if ("status" in data) (data as { status: string }).status = "expired";
      });
    }
    return;
  }

  // ── Token / Compaction ──
  if (type === "token_health.warning") {
    appendSystemNotice("Token usage warning — consider compacting");
    return;
  }

  if (type === "compaction.suggested") {
    appendSystemNotice("Compaction suggested — context usage is high");
    return;
  }

  // ── Agent ──
  if (type === "agent.selected") {
    const agentId = p.agentId as string | undefined;
    if (agentId) setCurrentAgentId(agentId);
    return;
  }
}
