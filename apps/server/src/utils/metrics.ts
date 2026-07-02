class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private counterLabels = new Map<string, Map<string, number>>();

  inc(name: string, labels?: Record<string, string>): void {
    if (labels) {
      const labelKey = JSON.stringify(labels);
      const byLabels = this.counterLabels.get(name) || new Map();
      byLabels.set(labelKey, (byLabels.get(labelKey) || 0) + 1);
      this.counterLabels.set(name, byLabels);
    } else {
      this.counters.set(name, (this.counters.get(name) || 0) + 1);
    }
  }

  set(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  toPrometheus(): string {
    const lines: string[] = [];
    for (const [name, value] of this.counters) {
      lines.push(`# HELP ${name} Counter`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, byLabels] of this.counterLabels) {
      lines.push(`# HELP ${name} Counter (with labels)`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labelJson, value] of byLabels) {
        const labels = JSON.parse(labelJson) as Record<string, string>;
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        lines.push(`${name}{${labelStr}} ${value}`);
      }
    }
    for (const [name, value] of this.gauges) {
      lines.push(`# HELP ${name} Gauge`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    return lines.join("\n") + "\n";
  }
}

export const metrics = new MetricsRegistry();
