import type { CostRecord, CostSummary } from "@agent-workbench/protocol";
import { SmartRouter } from "./smart-router";

/**
 * Per-session cost tracking.
 *
 * Tracks token usage and computes cost estimates for each model call.
 * Persistence is handled by the caller (e.g., writing to the run ledger).
 */
export class CostTracker {
  /** In-memory cost records, keyed by session ID. */
  private readonly sessionRecords: Map<string, CostRecord[]> = new Map();

  /** Day-level aggregation cache. */
  private readonly dailyCosts: Map<string, number> = new Map();

  /**
   * Record a model call cost.
   *
   * @param sessionId - The session the call was made in.
   * @param providerId - The provider used.
   * @param model - The model used.
   * @param inputTokens - Number of input tokens consumed.
   * @param outputTokens - Number of output tokens consumed.
   * @param costPer1KInput - Cost per 1K input tokens (USD).
   * @param costPer1KOutput - Cost per 1K output tokens (USD).
   */
  recordCall(
    sessionId: string,
    providerId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costPer1KInput?: number,
    costPer1KOutput?: number,
  ): CostRecord {
    // Use default costs if not provided
    const { input: defaultInput, output: defaultOutput } =
      SmartRouter.getDefaultCost(model);

    const inputCost = (costPer1KInput ?? defaultInput) * (inputTokens / 1000);
    const outputCost = (costPer1KOutput ?? defaultOutput) * (outputTokens / 1000);
    const totalCost = inputCost + outputCost;

    const record: CostRecord = {
      providerId,
      model,
      inputTokens,
      outputTokens,
      cost: Math.round(totalCost * 1000000) / 1000000, // Round to micro-dollar precision
      timestamp: new Date().toISOString(),
    };

    // Store per-session
    const records = this.sessionRecords.get(sessionId) ?? [];
    records.push(record);
    this.sessionRecords.set(sessionId, records);

    // Track daily cost
    const dayKey = new Date().toISOString().slice(0, 10);
    this.dailyCosts.set(dayKey, (this.dailyCosts.get(dayKey) ?? 0) + totalCost);

    return record;
  }

  /**
   * Get all cost records for a session.
   */
  getSessionRecords(sessionId: string): CostRecord[] {
    return this.sessionRecords.get(sessionId) ?? [];
  }

  /**
   * Get cost summary for a session.
   */
  getSessionSummary(sessionId: string): CostSummary {
    const records = this.getSessionRecords(sessionId);
    return this.aggregate(records, sessionId);
  }

  /**
   * Get cost summary for a specific day (YYYY-MM-DD format).
   */
  getDaySummary(dayKey: string): CostSummary {
    const allRecords = Array.from(this.sessionRecords.values()).flat();
    const dayRecords = allRecords.filter((r) => r.timestamp.startsWith(dayKey));
    return this.aggregate(dayRecords, `day:${dayKey}`);
  }

  /**
   * Get total estimated cost for the current day.
   */
  getDailyTotal(): number {
    const dayKey = new Date().toISOString().slice(0, 10);
    return this.dailyCosts.get(dayKey) ?? 0;
  }

  /**
   * Get all daily totals.
   */
  getDailyTotals(): Map<string, number> {
    return new Map(this.dailyCosts);
  }

  /**
   * Reset all records (useful for testing).
   */
  reset(): void {
    this.sessionRecords.clear();
    this.dailyCosts.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private aggregate(
    records: CostRecord[],
    periodId: string,
  ): CostSummary {
    if (records.length === 0) {
      const now = new Date().toISOString();
      return {
        periodStart: now,
        periodEnd: now,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        calls: 0,
        providerBreakdown: {},
      };
    }

    const sorted = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const totalInput = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutput = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Provider breakdown
    const providerMap = new Map<
      string,
      { cost: number; calls: number; inputTokens: number; outputTokens: number }
    >();
    for (const r of records) {
      const key = r.providerId;
      const existing = providerMap.get(key) ?? {
        cost: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      existing.cost += r.cost;
      existing.calls += 1;
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      providerMap.set(key, existing);
    }

    const providerBreakdown: Record<string, { cost: number; calls: number; inputTokens: number; outputTokens: number }> = {};
    for (const [key, value] of providerMap) {
      providerBreakdown[key] = value;
    }

    // Round totalCost
    const roundedTotal = Math.round(totalCost * 1000000) / 1000000;

    return {
      periodStart: sorted[0]!.timestamp,
      periodEnd: sorted[sorted.length - 1]!.timestamp,
      totalCost: roundedTotal,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      calls: records.length,
      providerBreakdown,
    };
  }
}
