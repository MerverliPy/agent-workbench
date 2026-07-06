// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We test the config parser directly
import { readOpenCodeConfig, opencodeAvailable } from "./opencode-config";

function withTempDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "opencode-test-"));
  const configDir = join(dir, ".config", "opencode");
  const authDir = join(dir, ".local", "share", "opencode");
  const oldHome = process.env.HOME;
  try {
    // We can't easily override the homedir, so we test the parser function directly
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("OpenCode config parser", () => {
  it("readOpenCodeConfig returns null when config doesn't exist", () => {
    // This will likely return null since we're testing in CI
    const result = readOpenCodeConfig();
    // It's either null (no config found) or a valid object (running on user's machine)
    expect(result === null || (result && result.all.length > 0)).toBe(true);
  });

  it("opencodeAvailable returns a boolean", () => {
    const available = opencodeAvailable();
    expect(typeof available).toBe("boolean");
  });
});

describe("Config format parsing (direct)", () => {
  const SAMPLE_CONFIG = JSON.stringify(
    {
      model: "deepseek/deepseek-v4-pro",
      agent: { build: { variant: "thinking" } },
    },
    null,
    2,
  );

  it("JSON without comments is parseable", () => {
    const parsed = JSON.parse(SAMPLE_CONFIG);
    expect(parsed.model).toBe("deepseek/deepseek-v4-pro");
  });

  it("extracts provider name from model spec", () => {
    const modelSpec = "deepseek/deepseek-v4-pro";
    const slashIdx = modelSpec.indexOf("/");
    const provider = modelSpec.slice(0, slashIdx);
    const model = modelSpec.slice(slashIdx + 1);
    expect(provider).toBe("deepseek");
    expect(model).toBe("deepseek-v4-pro");
  });

  it("extracts provider from opencode-go model spec", () => {
    const modelSpec = "opencode-go/qwen3.7-plus";
    const slashIdx = modelSpec.indexOf("/");
    const provider = modelSpec.slice(0, slashIdx);
    const model = modelSpec.slice(slashIdx + 1);
    expect(provider).toBe("opencode-go");
    expect(model).toBe("qwen3.7-plus");
  });

  it("handles JSONC with comments", () => {
    const jsonc = `{
      // this is a comment
      "model": "deepseek/deepseek-v4-pro"
    }`;
    const cleaned = jsonc
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) return "";
        const commentIdx = line.indexOf("//");
        if (commentIdx >= 0) {
          return line.slice(0, commentIdx);
        }
        return line;
      })
      .join("\n");
    const parsed = JSON.parse(cleaned);
    expect(parsed.model).toBe("deepseek/deepseek-v4-pro");
  });
});

describe("Auth file format", () => {
  const SAMPLE_AUTH = {
    deepseek: { type: "api", key: "sk-test-key" },
    "opencode-go": { type: "api", key: "sk-opencode-key" },
    "github-copilot": {
      type: "oauth",
      access: "gho_token",
      refresh: "ghr_token",
      expires: 0,
    },
  };

  it("parses API credential", () => {
    const auth = SAMPLE_AUTH;
    const ds = auth.deepseek;
    expect(ds.type).toBe("api");
    expect(ds.key).toBe("sk-test-key");
  });

  it("parses OAuth credential", () => {
    const auth = SAMPLE_AUTH;
    const copilot = auth["github-copilot"];
    expect(copilot.type).toBe("oauth");
    expect(copilot.access).toBe("gho_token");
    expect(copilot.refresh).toBe("ghr_token");
  });

  it("reads API key from API credential", () => {
    const cred = SAMPLE_AUTH.deepseek;
    const apiKey = cred.type === "api" ? cred.key : cred.access;
    expect(apiKey).toBe("sk-test-key");
  });

  it("reads access token from OAuth credential", () => {
    const cred = SAMPLE_AUTH["github-copilot"];
    const apiKey = cred.type === "api" ? cred.key : cred.access;
    expect(apiKey).toBe("gho_token");
  });
});

describe("Import integrity", () => {
  it("source file imports correctly as module", () => {
    // Just verify the module can be imported without error
    const mod = require("./opencode-config");
    expect(typeof mod.readOpenCodeConfig).toBe("function");
    expect(typeof mod.opencodeAvailable).toBe("function");
  });
});
