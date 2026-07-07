#!/usr/bin/env node
/**
 * E2E Flakiness Audit Benchmark
 *
 * Analyzes the playwright-e2e-testing skill (SKILL.md) plus the existing
 * app.spec.ts test for flakiness risk patterns as specified in the
 * Flakiness Pattern Validation benchmark.
 *
 * Usage: node benchmarks/e2e-flakiness-audit.mjs
 * Output: benchmarks/e2e-flakiness-audit.json + stdout JSON
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUTPUT_PATH = join(__dirname, "e2e-flakiness-audit.json");

const SKILL_PATH = join(
  homedir(),
  ".hermes/skills/software-development/playwright-e2e-testing/SKILL.md",
);
const EXISTING_TEST_PATH = join(
  PROJECT_ROOT,
  "apps/mobile-web/e2e/app.spec.ts",
);

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract all markdown code blocks (```…```) from a string. */
function extractCodeBlocks(md) {
  const blocks = [];
  const re =
    /```(?:typescript|ts|javascript|js|yaml|yml|bash|sh)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    blocks.push({ content: m[1], start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

/** Count occurrences of a regex in a string. Returns count + array of matched snippets with context. */
function findPattern(text, pattern, _label) {
  const re = new RegExp(pattern, "g");
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    // Grab ±40 chars of context around the match
    const ctxStart = Math.max(0, m.index - 40);
    const ctxEnd = Math.min(text.length, m.index + m[0].length + 40);
    const context = text.slice(ctxStart, ctxEnd).replace(/\n/g, " ").trim();
    matches.push({
      match: m[0],
      context,
      lineHint: text.slice(0, m.index).split("\n").length,
    });
  }
  return { count: matches.length, matches };
}

/** Find hardcoded timeout numeric values in code, return list with values. */
function findTimeoutValues(text) {
  const re = /\b(\d{3,6})\b/g;
  const values = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1], 10);
    // Filter likely timeout-related: near keywords like timeout, waitFor, etc.
    const before = text.slice(Math.max(0, m.index - 50), m.index);
    const isTimeout = /timeout|wait|delay|retry|interval|poll/i.test(before);
    if (isTimeout) {
      const ctxStart = Math.max(0, m.index - 30);
      const ctxEnd = Math.min(text.length, m.index + m[0].length + 30);
      values.push({
        value: val,
        over2000ms: val > 2000,
        context: text.slice(ctxStart, ctxEnd).replace(/\n/g, " ").trim(),
      });
    }
  }
  // Deduplicate by value+context (same number may appear multiple times in same line)
  const seen = new Set();
  const unique = [];
  for (const v of values) {
    const key = `${v.value}|${v.context}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  return unique;
}

/**
 * Check if a test block (a code snippet containing `test(`) uses waitForTimeout
 * without a corresponding DOM-based assertion afterward.
 * Returns array of failing blocks.
 */
function checkWaitForTimeoutWithoutDomAssertion(codeBlocks) {
  const failures = [];
  for (const block of codeBlocks) {
    // Only analyze blocks that contain test() definitions
    if (!/\btest\s*\(/.test(block.content)) continue;

    // Find waitForTimeout calls
    const wftRe = /await\s+\S*\.waitForTimeout\s*\(\s*(\d+)\s*\)/g;
    let wftMatch;
    while ((wftMatch = wftRe.exec(block.content)) !== null) {
      const afterCall = block.content.slice(
        wftMatch.index + wftMatch[0].length,
      );
      // Look for DOM-based assertions after this waitForTimeout in the same block
      // Non-greedy match with {1,2} close-parens to handle nesting like:
      //   expect(page.getByText(/foo/i)).not.toBeVisible()
      //   expect(page.locator("body")).not.toBeEmpty()
      const hasDomAssertion =
        /expect\s*\(.+?\){1,2}\s*\.(?:not\.)?(?:toBeVisible|toHaveText|toHaveAttribute|toHaveCount|toBeEmpty|toContainText)\b/.test(
          afterCall.slice(0, 1000),
        );
      if (!hasDomAssertion) {
        const ctxStart = Math.max(0, wftMatch.index - 60);
        const ctxEnd = Math.min(
          block.content.length,
          wftMatch.index + wftMatch[0].length + 60,
        );
        failures.push({
          value: parseInt(wftMatch[1], 10),
          context: block.content
            .slice(ctxStart, ctxEnd)
            .replace(/\n/g, " ")
            .trim(),
          lineHint: block.content.slice(0, wftMatch.index).split("\n").length,
        });
      }
    }
  }
  return failures;
}

// ── Main Analysis ────────────────────────────────────────────────────

console.error("Loading skill from:", SKILL_PATH);
const skillMd = readFileSync(SKILL_PATH, "utf-8");
const existingTest = readFileSync(EXISTING_TEST_PATH, "utf-8");

// Extract code blocks from the skill
const skillCodeBlocks = extractCodeBlocks(skillMd);
const allSkillCode = skillCodeBlocks.map((b) => b.content).join("\n");

console.error(`Extracted ${skillCodeBlocks.length} code blocks from skill`);

// ── 1) waitForTimeout (high-flakiness-risk) ─────────────────────────
const wftSkill = findPattern(
  allSkillCode,
  /await\s+\S*\.waitForTimeout\s*\(\s*\d+\s*\)/g,
  "waitForTimeout",
);
const wftExisting = findPattern(
  existingTest,
  /await\s+\S*\.waitForTimeout\s*\(\s*\d+\s*\)/g,
  "waitForTimeout",
);

const highFlakinessRisk = {
  skill: { count: wftSkill.count, occurrences: wftSkill.matches },
  existing_test: {
    count: wftExisting.count,
    occurrences: wftExisting.matches,
  },
  total: wftSkill.count + wftExisting.count,
};

// ── 2) Deterministic waits (low-flakiness-risk) ──────────────────────
const deterministicPatterns = [
  { name: "waitForSelector", pattern: /await\s+\S*\.waitForSelector\s*\(/g },
  { name: "waitForFunction", pattern: /await\s+\S*\.waitForFunction\s*\(/g },
  { name: "toBeVisible", pattern: /\.toBeVisible\s*\(/g },
  { name: "waitFor", pattern: /\.waitFor\s*\(\s*\{/g },
  { name: "toHaveText", pattern: /\.toHaveText\s*\(/g },
];

const lowFlakinessRisk = {};
let totalDeterministic = 0;

for (const { name, pattern } of deterministicPatterns) {
  const skillResult = findPattern(allSkillCode, pattern, name);
  const existingResult = findPattern(existingTest, pattern, name);
  lowFlakinessRisk[name] = {
    skill: skillResult.count,
    existing_test: existingResult.count,
    total: skillResult.count + existingResult.count,
    occurrences: [...skillResult.matches, ...existingResult.matches],
  };
  totalDeterministic += lowFlakinessRisk[name].total;
}

// ── 3) Flakiness safety ratio ────────────────────────────────────────
const totalWaits = highFlakinessRisk.total + totalDeterministic;
const safetyRatio =
  totalWaits > 0
    ? parseFloat((totalDeterministic / totalWaits).toFixed(4))
    : 1.0;

// ── 4) waitForTimeout without DOM assertion ──────────────────────────
const wftNoDomAssertSkill =
  checkWaitForTimeoutWithoutDomAssertion(skillCodeBlocks);

// For the existing test file, treat it as a single code block
const wftNoDomAssertExisting = checkWaitForTimeoutWithoutDomAssertion([
  { content: existingTest, start: 0, end: existingTest.length },
]);

// ── 5) Hardcoded timeout values ──────────────────────────────────────
const timeoutValuesSkill = findTimeoutValues(allSkillCode);
const timeoutValuesExisting = findTimeoutValues(existingTest);
const allTimeoutValues = [...timeoutValuesSkill, ...timeoutValuesExisting];
const over2000ms = allTimeoutValues.filter((t) => t.over2000ms);

// ── 6) waitForLoadState('networkidle') ───────────────────────────────
const networkIdleSkill = findPattern(
  allSkillCode,
  /waitForLoadState\s*\(\s*["']networkidle["']\s*\)/g,
  "networkidle",
);
const networkIdleExisting = findPattern(
  existingTest,
  /waitForLoadState\s*\(\s*["']networkidle["']\s*\)/g,
  "networkidle",
);

// ── Assemble result ──────────────────────────────────────────────────
const result = {
  benchmark: "e2e-flakiness-audit",
  timestamp: new Date().toISOString(),
  targets: {
    skill: "playwright-e2e-testing",
    skill_path: SKILL_PATH,
    existing_test: EXISTING_TEST_PATH,
  },
  summary: {
    high_flakiness_risk_count: highFlakinessRisk.total,
    low_flakiness_risk_count: totalDeterministic,
    total_waits: totalWaits,
    flakiness_safety_ratio: safetyRatio,
    safety_grade:
      safetyRatio >= 0.9
        ? "A (excellent)"
        : safetyRatio >= 0.75
          ? "B (good)"
          : safetyRatio >= 0.5
            ? "C (concerning)"
            : "D (poor)",
    waitForTimeout_without_dom_assertion_count:
      wftNoDomAssertSkill.length + wftNoDomAssertExisting.length,
    hardcoded_timeouts_total: allTimeoutValues.length,
    hardcoded_timeouts_over_2000ms: over2000ms.length,
    networkidle_occurrences: networkIdleSkill.count + networkIdleExisting.count,
  },
  details: {
    waitForTimeout_high_flakiness_risk: highFlakinessRisk,
    deterministic_waits_low_flakiness_risk: lowFlakinessRisk,
    waitForTimeout_without_dom_assertion: {
      skill: wftNoDomAssertSkill,
      existing_test: wftNoDomAssertExisting,
    },
    hardcoded_timeout_values: {
      all: allTimeoutValues,
      over_2000ms: over2000ms,
    },
    networkidle_sse_breaking_pattern: {
      skill: networkIdleSkill,
      existing_test: networkIdleExisting,
      total: networkIdleSkill.count + networkIdleExisting.count,
    },
  },
};

// ── Output ───────────────────────────────────────────────────────────
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
