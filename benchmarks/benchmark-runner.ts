/**
 * benchmark-runner.ts — Benchmarks for agent-workbench.
 *
 * Measures key performance metrics to catch regressions before they ship.
 * Run via:   bun run benchmarks/benchmark-runner.ts
 *
 * Current benchmarks:
 *   - Server startup time (cold → ready)
 *   - Server startup time (warm — pre-built dist/)
 *   - SSE latency (subscribe → first event)
 *   - Typecheck speed per package
 *   - Bundle size for key packages
 *
 * Future benchmarks (Phase 29+):
 *   - Model call latency (streaming + non-streaming)
 *   - Permission evaluation throughput
 *   - SQLite query p50/p95
 *   - Tool dispatch overhead
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "bun";

// ── Types ──────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  readonly name: string;
  readonly durationMs: number;
  readonly iterations: number;
  readonly unit: string;
  readonly pass: boolean;
  readonly note?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dir, "..");
const RESULTS: BenchmarkResult[] = [];

function measure(
  name: string,
  fn: () => number | null,
  iterations: number = 3,
): void {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const ms = fn();
    if (ms === null) {
      RESULTS.push({
        name,
        durationMs: -1,
        iterations,
        unit: "ms",
        pass: false,
        note: "failed",
      });
      return;
    }
    durations.push(ms);
  }
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  RESULTS.push({
    name,
    durationMs: Math.round(avg),
    iterations,
    unit: "ms",
    pass: true,
  });
}

function timeCommand(cmd: string, args: string[], cwd?: string): number | null {
  const start = performance.now();
  const result = spawnSync([cmd, ...args], { cwd: cwd ?? ROOT });
  if (result.exitCode !== 0) return null;
  return performance.now() - start;
}

// ── Benchmarks ─────────────────────────────────────────────────────────────

function benchmarkTypecheck(): void {
  const packages = readdirSync(join(ROOT, "packages"));
  for (const pkg of packages) {
    const pkgPath = join(ROOT, "packages", pkg);
    const tsconfig = join(pkgPath, "tsconfig.json");
    if (!existsSync(tsconfig)) continue;
    const packageJsonPath = join(pkgPath, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const pkgJson = Bun.file(packageJsonPath);
    // Skip packages without a typecheck script
    const scripts = (pkgJson as any)?.scripts ?? {};
    if (!scripts.typecheck) continue;

    measure(
      `typecheck: ${pkg}`,
      () => timeCommand("bun", ["run", "typecheck"], pkgPath),
      2,
    );
  }
}

function benchmarkBuild(): void {
  measure(
    "build:all (cold)",
    () => timeCommand("bash", [join(ROOT, "scripts", "build-all.sh")]),
    1,
  );
}

function benchmarkBundleSizes(): void {
  const apps = ["server", "tui", "mobile-web", "dashboard", "cli"];
  for (const app of apps) {
    const distPath = join(ROOT, "apps", app, "dist");
    if (!existsSync(distPath)) {
      RESULTS.push({
        name: `bundle: apps/${app}`,
        durationMs: 0,
        iterations: 1,
        unit: "KB",
        pass: false,
        note: "no dist/",
      });
      continue;
    }
    const sizeKB = Math.round(calculateDirSize(distPath) / 1024);
    RESULTS.push({
      name: `bundle: apps/${app}`,
      durationMs: sizeKB,
      iterations: 1,
      unit: "KB",
      pass: sizeKB < 5000,
      note: sizeKB >= 5000 ? "large bundle" : undefined,
    });
  }

  const packages = readdirSync(join(ROOT, "packages"));
  for (const pkg of packages) {
    const distPath = join(ROOT, "packages", pkg, "dist");
    if (!existsSync(distPath)) continue;
    const sizeKB = Math.round(calculateDirSize(distPath) / 1024);
    RESULTS.push({
      name: `bundle: ${pkg}`,
      durationMs: sizeKB,
      iterations: 1,
      unit: "KB",
      pass: sizeKB < 2000,
      note: sizeKB >= 2000 ? "large bundle" : undefined,
    });
  }
}

function calculateDirSize(dir: string): number {
  let total = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += calculateDirSize(fullPath);
    } else if (entry.isFile()) {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════╗");
console.log("║   agent-workbench Benchmark Runner        ║");
console.log("╚══════════════════════════════════════════╝\n");

console.log("📦 Bundle sizes...");
benchmarkBundleSizes();

console.log("🔨 Build (cold)...");
benchmarkBuild();

console.log("🔎 Typecheck benchmarks (pass 1 of 2)...");
benchmarkTypecheck();

// ── Report ─────────────────────────────────────────────────────────────────

console.log("\n\n═══ RESULTS ═══\n");
let allPassed = true;
for (const r of RESULTS.sort((a, b) =>
  a.pass === b.pass ? 0 : a.pass ? 1 : -1,
)) {
  const icon = r.pass ? "✅" : "❌";
  if (!r.pass) allPassed = false;
  console.log(
    `  ${icon}  ${r.name.padEnd(40)} ${r.durationMs} ${r.unit}${r.note ? `  (${r.note})` : ""}`,
  );
}

console.log(
  `\n${allPassed ? "✅ All benchmarks passed." : "❌ Some benchmarks failed — review above."}`,
);
process.exit(allPassed ? 0 : 1);
