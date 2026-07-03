/**
 * In-memory metrics store that can export to Prometheus text format.
 * Supports counters, gauges, and latency histograms.
 */

/** Default histogram buckets in milliseconds. */
const DEFAULT_BUCKETS_MS = [
  1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

interface HistogramStore {
  buckets: number[];
  counts: number[];
  totalCount: number;
  totalSum: number;
}

/**
 * In-memory metrics store with Prometheus-compatible export.
 */
export class MetricsExporter {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramStore>();
  private readonly spanBuckets: number[];

  constructor(options?: { latencyBucketsMs?: number[] }) {
    this.spanBuckets = options?.latencyBucketsMs ?? DEFAULT_BUCKETS_MS;
  }

  // ── Counters ─────────────────────────────────────────────────────────────

  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    by = 1,
  ): void {
    const key = this.mkKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    return this.counters.get(this.mkKey(name, labels)) ?? 0;
  }

  // ── Gauges ────────────────────────────────────────────────────────────────

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(this.mkKey(name, labels), value);
  }

  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    return this.gauges.get(this.mkKey(name, labels));
  }

  // ── Histograms ────────────────────────────────────────────────────────────

  observeLatency(
    name: string,
    durationMs: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.mkKey(name, labels);
    let h = this.histograms.get(key);
    if (h === undefined) {
      h = {
        buckets: this.spanBuckets,
        counts: new Array(this.spanBuckets.length).fill(0),
        totalCount: 0,
        totalSum: 0,
      };
      this.histograms.set(key, h);
    }

    h.totalCount += 1;
    h.totalSum += durationMs;

    for (let i = 0; i < h.buckets.length; i++) {
      if (durationMs <= h.buckets[i]!) {
        h.counts[i]! += 1;
        break;
      }
    }
  }

  // ── Span recording ───────────────────────────────────────────────────────

  /** Record a completed span as latency + counter metrics. */
  recordSpan(span: {
    name: string;
    status: string;
    startTime: number;
    endTime?: number;
  }): void {
    const duration =
      span.endTime !== undefined ? span.endTime - span.startTime : 0;
    this.incrementCounter("spans_total", {
      span: span.name,
      status: span.status,
    });
    this.observeLatency("span_duration_ms", duration, { span: span.name });

    if (span.status === "error") {
      this.incrementCounter("spans_errors_total", { span: span.name });
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Export all metrics in Prometheus text format. */
  toPrometheus(): string {
    const lines: string[] = [];

    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      lines.push(`# HELP ${this.esc(name)} Counter`);
      lines.push(`# TYPE ${this.esc(name)} counter`);
      lines.push(`${this.esc(name)}${this.fmtLabels(labels)} ${value}`);
    }

    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseKey(key);
      lines.push(`# HELP ${this.esc(name)} Gauge`);
      lines.push(`# TYPE ${this.esc(name)} gauge`);
      lines.push(`${this.esc(name)}${this.fmtLabels(labels)} ${value}`);
    }

    for (const [key, h] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const baseName = this.esc(name);

      lines.push(`# HELP ${baseName}_duration_ms Histogram`);
      lines.push(`# TYPE ${baseName}_duration_ms histogram`);

      let cumulative = 0;
      for (let i = 0; i < h.buckets.length; i++) {
        cumulative += h.counts[i]!;
        const le = h.buckets[i] === Infinity ? "+Inf" : String(h.buckets[i]);
        lines.push(
          `${baseName}_duration_ms_bucket${this.fmtLabels(labels)}{le="${le}"} ${cumulative}`,
        );
      }
      lines.push(
        `${baseName}_duration_ms_bucket${this.fmtLabels(labels)}{le="+Inf"} ${h.totalCount}`,
      );
      lines.push(
        `${baseName}_duration_ms_sum${this.fmtLabels(labels)} ${h.totalSum}`,
      );
      lines.push(
        `${baseName}_duration_ms_count${this.fmtLabels(labels)} ${h.totalCount}`,
      );
    }

    return `${lines.join("\n")}\n`;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private mkKey(name: string, labels?: Record<string, string>): string {
    if (labels === undefined || Object.keys(labels).length === 0) return name;
    return `${name}|${JSON.stringify(labels)}`;
  }

  private parseKey(key: string): {
    name: string;
    labels?: Record<string, string>;
  } {
    const pipeIdx = key.indexOf("|");
    if (pipeIdx === -1) return { name: key };
    return {
      name: key.slice(0, pipeIdx),
      labels: JSON.parse(key.slice(pipeIdx + 1)) as Record<string, string>,
    };
  }

  private fmtLabels(labels?: Record<string, string>): string {
    if (labels === undefined || Object.keys(labels).length === 0) return "";
    const entries = Object.entries(labels);
    return `{${entries.map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`).join(",")}}`;
  }

  private esc(name: string): string {
    return name.replace(/[^a-zA-Z0-9_:]/g, "_");
  }
}
