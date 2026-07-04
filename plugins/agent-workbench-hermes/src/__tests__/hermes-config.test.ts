/**
 * Tests for Hermes config reader.
 *
 * All tests use temp directories with synthetic data — never touches real ~/.hermes/.
 */

import { describe, expect, test, beforeAll, afterAll, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { HermesConfig } from "../hermes-config";

// ── Setup ───────────────────────────────────────────────────────────────────

const tempDir = mkdtempSync(join(tmpdir(), "hermes-config-test-"));
const hermesDir = join(tempDir, ".hermes");

let readHermesConfig: typeof import("../hermes-config").readHermesConfig;
let hermesAvailable: typeof import("../hermes-config").hermesAvailable;

beforeAll(async () => {
  // Create synthetic .hermes/ dir
  mkdirSync(hermesDir, { recursive: true });

  // Mock homedir BEFORE importing the module under test
  // This ensures CONFIG_PATH and AUTH_PATH resolve inside tempDir
  mock.module("node:os", () => ({
    homedir: () => tempDir,
  }));

  // Mock process.env so env: sourced keys resolve
  process.env.HERMES_TEST_DEEPSEEK_KEY = "sk-ds-test-key-12345";
  process.env.HERMES_TEST_OPENAI_KEY = "sk-openai-test-key-67890";

  const mod = await import("../hermes-config");
  readHermesConfig = mod.readHermesConfig;
  hermesAvailable = mod.hermesAvailable;
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.HERMES_TEST_DEEPSEEK_KEY;
  delete process.env.HERMES_TEST_OPENAI_KEY;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function writeConfig(content: string): void {
  writeFileSync(join(hermesDir, "config.yaml"), content, "utf-8");
}

function writeAuth(content: object): void {
  writeFileSync(join(hermesDir, "auth.json"), JSON.stringify(content, null, 2), "utf-8");
}

function cleanConfig(): void {
  try {
    rmSync(join(hermesDir, "config.yaml"), { force: true });
    rmSync(join(hermesDir, "auth.json"), { force: true });
  } catch {
    // ignore
  }
}

// Note: each test in this file calls cleanConfig() + writes new data
// and tests are ordered to avoid interference. The mock.module happens
// once in beforeAll and applies for the lifetime of the file.

// ── Tests ───────────────────────────────────────────────────────────────────

describe("hermesAvailable()", () => {
  test("returns false when config.yaml does not exist", () => {
    cleanConfig();
    expect(hermesAvailable()).toBe(false);
  });

  test("returns true when config.yaml exists", () => {
    writeConfig("model:\n  default: deepseek-v4-flash\n  provider: deepseek\n");
    expect(hermesAvailable()).toBe(true);
    cleanConfig();
  });
});

describe("readHermesConfig() — file not found", () => {
  test("returns null when config.yaml does not exist", () => {
    cleanConfig();
    expect(readHermesConfig()).toBeNull();
  });
});

describe("readHermesConfig() — basic config with auth", () => {
  test("parses default provider with credentials from auth.json", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: deepseek-v4-flash
  provider: deepseek
`);

    writeAuth({
      version: 1,
      credential_pool: {
        deepseek: [
          {
            label: "deepseek-main",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
            base_url: "https://api.deepseek.com/v1",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.provider).toBe("deepseek");
    expect(config!.default.model).toBe("deepseek-v4-flash");
    expect(config!.default.apiKey).toBe("sk-ds-test-key-12345");
    expect(config!.default.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(config!.default.isPrimary).toBe(true);
    expect(config!.fallbacks).toHaveLength(0);
    expect(config!.all).toHaveLength(1);
  });
});

describe("readHermesConfig() — no auth file", () => {
  test("returns config with undefined apiKey and baseUrl when auth.json missing", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: deepseek-v4-flash
  provider: deepseek
`);

    // No auth.json written
    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.provider).toBe("deepseek");
    expect(config!.default.apiKey).toBeUndefined();
    expect(config!.default.baseUrl).toBeUndefined();
    expect(config!.default.isPrimary).toBe(true);
  });
});

describe("readHermesConfig() — env: API key resolution", () => {
  test("resolves env: sources to process.env values", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: gpt-4o
  provider: openai
`);

    writeAuth({
      version: 1,
      credential_pool: {
        openai: [
          {
            label: "openai-prod",
            auth_type: "bearer",
            source: "env:HERMES_TEST_OPENAI_KEY",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.apiKey).toBe("sk-openai-test-key-67890");

    // Clean up
    cleanConfig();
  });

  test("returns undefined apiKey when env var is not set", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: gpt-4o
  provider: openai
`);

    writeAuth({
      version: 1,
      credential_pool: {
        openai: [
          {
            label: "openai-prod",
            auth_type: "bearer",
            source: "env:NONEXISTENT_VAR",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.apiKey).toBeUndefined();
    cleanConfig();
  });
});

describe("readHermesConfig() — fallback providers", () => {
  test("parses a single fallback provider", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: deepseek-v4-flash
  provider: deepseek

fallback_providers:
  - provider: opencode-go
    model: qwen3.7-plus
`);

    writeAuth({
      version: 1,
      credential_pool: {
        deepseek: [
          {
            label: "ds",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
            base_url: "https://api.deepseek.com/v1",
          },
        ],
        "opencode-go": [
          {
            label: "ocg",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
            base_url: "https://opencode.ai/zen/go/v1",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.provider).toBe("deepseek");
    expect(config!.fallbacks).toHaveLength(1);
    expect(config!.fallbacks[0]!.provider).toBe("opencode-go");
    expect(config!.fallbacks[0]!.model).toBe("qwen3.7-plus");
    expect(config!.all).toHaveLength(2);
  });

  test("parses multiple fallback providers in order", () => {
    cleanConfig();

    writeConfig(`\
model:
  default: deepseek-v4-flash
  provider: deepseek

fallback_providers:
  - provider: opencode-go
    model: qwen3.7-plus
  - provider: groq
    model: llama-4-scout
`);

    writeAuth({
      version: 1,
      credential_pool: {
        deepseek: [
          {
            label: "ds",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
          },
        ],
        "opencode-go": [
          {
            label: "ocg",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
          },
        ],
        groq: [
          {
            label: "groq",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.fallbacks).toHaveLength(2);
    expect(config!.fallbacks[0]!.provider).toBe("opencode-go");
    expect(config!.fallbacks[1]!.provider).toBe("groq");
    expect(config!.all).toHaveLength(3);
  });
});

describe("readHermesConfig() — edge cases", () => {
  test("handles binary/garbage content without throwing", () => {
    cleanConfig();

    // The line-based parser doesn't crash on binary content,
    // it just doesn't match any patterns — returns unknown fallback
    writeConfig("\x00\x00\x00invalid\x00");

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    // Falls through to the "unknown" fallback default
    expect(config!.default.provider).toBe("unknown");
  });

  test("returns fallback defaults when config has no section headers", () => {
    cleanConfig();

    writeConfig(`\
some_random_key: foo
another_line: bar
`);

    // No recognizable sections → no entries parsed
    const config = readHermesConfig();
    expect(config).not.toBeNull();
    // default should be the fallback "unknown" entry
    expect(config!.default.provider).toBe("unknown");
    expect(config!.default.model).toBe("unknown");
    expect(config!.default.isPrimary).toBe(false);
    expect(config!.fallbacks).toHaveLength(0);
    expect(config!.all).toHaveLength(0);
  });

  test("handles comments and blank lines gracefully", () => {
    cleanConfig();

    writeConfig(`\
# This is a comment
model:
  # model default
  default: claude-sonnet-4

  # provider selection
  provider: anthropic

# Another comment section
`);

    writeAuth({
      version: 1,
      credential_pool: {
        anthropic: [
          {
            label: "anthropic",
            auth_type: "bearer",
            source: "env:HERMES_TEST_DEEPSEEK_KEY",
            base_url: "https://api.anthropic.com/v1",
          },
        ],
      },
    });

    const config = readHermesConfig();
    expect(config).not.toBeNull();
    expect(config!.default.provider).toBe("anthropic");
    expect(config!.default.model).toBe("claude-sonnet-4");
    cleanConfig();
  });
});
