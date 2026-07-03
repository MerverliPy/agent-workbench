import type { ProviderProfile } from "@agent-workbench/protocol";
import type { ProviderMarketplace } from "./marketplace";

/**
 * Health status of a single provider.
 */
export interface ProviderHealthStatus {
  providerId: string;
  /** Current operational status. */
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  /** Latency of the last health check in milliseconds. */
  lastLatencyMs?: number;
  /** Error message if unhealthy. */
  lastError?: string;
  /** ISO timestamp of the last check. */
  lastCheckedAt: string;
  /** Rolling error rate (0-1) over the window. */
  errorRate: number;
  /** Rolling p50 latency in ms. */
  p50LatencyMs?: number;
  /** Rolling p95 latency in ms. */
  p95LatencyMs?: number;
  /** Rolling p99 latency in ms. */
  p99LatencyMs?: number;
}

/**
 * Health check result from a single probe.
 */
interface HealthProbe {
  ok: boolean;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

/**
 * Provider health monitor.
 *
 * Periodically probes provider endpoints to track availability,
 * latency, and error rates. Used by the smart router to make
 * informed failover decisions.
 */
export class ProviderHealthMonitor {
  private readonly marketplace: ProviderMarketplace;
  private readonly probeHistory: Map<string, HealthProbe[]> = new Map();
  private readonly maxHistorySize: number;
  private readonly checkIntervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    marketplace: ProviderMarketplace,
    options?: {
      /** Max number of health probes to retain per provider. */
      maxHistorySize?: number;
      /** Interval between periodic health checks in ms. */
      checkIntervalMs?: number;
    },
  ) {
    this.marketplace = marketplace;
    this.maxHistorySize = options?.maxHistorySize ?? 20;
    this.checkIntervalMs = options?.checkIntervalMs ?? 60_000; // 1 minute
  }

  /**
   * Start periodic health checks.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Run an immediate check
    this.checkAll();

    // Schedule periodic checks
    this.timerId = setInterval(() => {
      this.checkAll();
    }, this.checkIntervalMs);
  }

  /**
   * Stop periodic health checks.
   */
  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Get the current health status of all providers.
   */
  getAllStatus(): ProviderHealthStatus[] {
    const profiles = this.marketplace.list({ enabledOnly: true });
    return profiles.map((p) => this.getStatus(p.id));
  }

  /**
   * Get the current health status of a single provider.
   */
  getStatus(providerId: string): ProviderHealthStatus {
    const probes = this.probeHistory.get(providerId) ?? [];
    const profile = this.marketplace.get(providerId);

    if (probes.length === 0) {
      return {
        providerId,
        status: profile?.enabled ? "unknown" : ("unknown" as const),
        errorRate: 0,
        lastCheckedAt: new Date().toISOString(),
      } as ProviderHealthStatus;
    }

    // Compute error rate over the window
    const errors = probes.filter((p) => !p.ok).length;
    const errorRate = probes.length > 0 ? errors / probes.length : 0;

    // Compute latency percentiles
    const latencies = probes
      .filter((p) => p.ok)
      .map((p) => p.latencyMs)
      .sort((a, b) => a - b);

    // Determine overall status
    let status: ProviderHealthStatus["status"];
    if (errorRate >= 0.5) {
      status = "unhealthy";
    } else if (errorRate >= 0.2) {
      status = "degraded";
    } else if (probes.length >= 2) {
      status = "healthy";
    } else {
      status = "unknown";
    }

    const lastProbe = probes[probes.length - 1];
    const hasProbes = lastProbe !== undefined;

    return {
      providerId,
      status,
      errorRate,
      ...(hasProbes
        ? {
            lastLatencyMs: lastProbe.latencyMs,
            ...(lastProbe.error !== undefined
              ? { lastError: lastProbe.error }
              : {}),
            lastCheckedAt: lastProbe.timestamp,
          }
        : {}),
      ...(latencies.length > 0
        ? {
            p50LatencyMs: this.percentile(latencies, 50),
            p95LatencyMs: this.percentile(latencies, 95),
            p99LatencyMs: this.percentile(latencies, 99),
          }
        : {}),
    } as ProviderHealthStatus;
  }

  /**
   * Check all enabled providers.
   */
  async checkAll(): Promise<ProviderHealthStatus[]> {
    const profiles = this.marketplace.list({ enabledOnly: true });
    const results = await Promise.allSettled(
      profiles.map((p) => this.checkProvider(p)),
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      return {
        providerId: profiles[i]?.id ?? "unknown",
        status: "unhealthy" as const,
        errorRate: 1,
        lastError:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
        lastCheckedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Probe a single provider's health.
   * Tries to reach the provider's base URL with a lightweight request.
   */
  async checkProvider(profile: ProviderProfile): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    let ok = false;
    let errorMsg: string | undefined;

    try {
      // For providers with a base URL, try a simple GET to check connectivity.
      // Ollama runs locally; OpenAI/Anthropic/OpenRouter may not have a
      // lightweight health endpoint, so we do a minimal probe.
      if (profile.baseUrl && profile.baseUrl.length > 0) {
        const healthUrl =
          profile.providerType === "ollama"
            ? `${profile.baseUrl.replace(/\/v1$/, "")}/api/tags`
            : `${profile.baseUrl}/models`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);

        try {
          const response = await fetch(healthUrl, {
            method: "GET",
            signal: controller.signal,
          });
          ok =
            response.ok || response.status === 401 || response.status === 403;
          // 401/403 means the endpoint is alive but requires auth — that's healthy
          if (!ok) {
            errorMsg = `HTTP ${response.status}`;
          }
        } finally {
          clearTimeout(timeout);
        }
      } else {
        // No base URL — mark as unknown
        ok = false;
        errorMsg = "No base URL configured for health check";
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - startTime;

    const probe: HealthProbe = {
      ok,
      latencyMs,
      timestamp,
      ...(errorMsg !== undefined ? { error: errorMsg } : {}),
    };

    // Record the probe
    const history = this.probeHistory.get(profile.id) ?? [];
    history.push(probe);
    // Trim to max size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    this.probeHistory.set(profile.id, history);

    return this.getStatus(profile.id);
  }

  /**
   * Record an error from a real model call (not a health probe).
   * This feeds into the error rate calculation.
   */
  recordError(providerId: string, error: Error): void {
    const probe: HealthProbe = {
      ok: false,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      error: error.message,
    };

    const history = this.probeHistory.get(providerId) ?? [];
    history.push(probe);
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    this.probeHistory.set(providerId, history);
  }

  /**
   * Record a successful model call (for latency tracking).
   */
  recordSuccess(providerId: string, latencyMs: number): void {
    const probe: HealthProbe = {
      ok: true,
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    const history = this.probeHistory.get(providerId) ?? [];
    history.push(probe);
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    this.probeHistory.set(providerId, history);
  }

  /**
   * Compute a percentile from sorted latency values.
   */
  private percentile(sorted: number[], p: number): number | undefined {
    if (sorted.length === 0) return undefined;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
