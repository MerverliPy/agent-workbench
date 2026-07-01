/// <reference types="bun" />
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  ProviderRegistry,
  ProviderConfigError,
} from "@agent-workbench/models";

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("ProviderRegistry — misconfigured OpenAI provider", () => {
  beforeEach(() => {
    restoreEnv();
    // Ensure no provider env is set by default
    delete process.env.AGENT_WORKBENCH_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AGENT_WORKBENCH_MODEL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("lists openai with status error when OPENAI_API_KEY is missing", () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai" });
    const registry = new ProviderRegistry();

    const meta = registry.getMetadata("openai");
    expect(meta).toBeDefined();
    expect(meta!.status).toBe("error");

    const list = registry.listMetadata();
    const openaiEntry = list.find((e) => e.id === "openai");
    expect(openaiEntry).toBeDefined();
    expect(openaiEntry!.status).toBe("error");
  });

  it("lists openai with status error for openai-compatible provider", () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai-compatible" });
    const registry = new ProviderRegistry();

    const meta = registry.getMetadata("openai");
    expect(meta).toBeDefined();
    expect(meta!.status).toBe("error");
  });

  it("default provider call fails with ProviderConfigError when OPENAI_API_KEY is missing", async () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai" });
    const registry = new ProviderRegistry();

    const provider = registry.getDefaultProvider();

    await expect(
      provider.call({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow(ProviderConfigError);

    await expect(
      provider.call({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow("API key is not set");
  });

  it("error message does not expose secrets or internal paths", async () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai" });
    const registry = new ProviderRegistry();

    const provider = registry.getDefaultProvider();
    let errorMessage = "";
    try {
      await provider.call({ messages: [{ role: "user", content: "test" }] });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    expect(errorMessage).not.toContain("sk-");
    expect(errorMessage).not.toContain("Bearer");
    expect(errorMessage).not.toContain("api_key");
    expect(errorMessage).not.toContain("OPENAI_API_KEY");
    // ProviderConfigError should not contain stacks or raw internals
    expect(errorMessage).not.toContain("at ");
    expect(errorMessage).not.toContain("node_modules");
  });

  it("stub provider remains available even when openai is misconfigured", () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai" });
    const registry = new ProviderRegistry();

    const stubProvider = registry.getProvider("stub");
    expect(stubProvider).toBeDefined();

    const stubMeta = registry.getMetadata("stub");
    expect(stubMeta).toBeDefined();
    expect(stubMeta!.status).toBe("connected");
  });

  it("does NOT fall back to stub when openai is explicitly requested but misconfigured", async () => {
    setEnv({ AGENT_WORKBENCH_PROVIDER: "openai" });
    const registry = new ProviderRegistry();

    // The default provider must fail with ProviderConfigError, proving
    // it did not silently fall back to the stub.
    const provider = registry.getDefaultProvider();
    let threwConfigError = false;
    try {
      await provider.call({ messages: [{ role: "user", content: "test" }] });
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        threwConfigError = true;
      }
    }
    expect(threwConfigError).toBe(true);
  });

  it("stub is the default provider when no AGENT_WORKBENCH_PROVIDER is set", async () => {
    delete process.env.AGENT_WORKBENCH_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    const registry = new ProviderRegistry();

    const provider = registry.getDefaultProvider();
    const response = await provider.call({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(response.kind.type).toBe("text");
    if (response.kind.type === "text") {
      expect(response.kind.content).toContain("stub");
    }
  });

  it("openai with valid key registers as connected", () => {
    setEnv({
      AGENT_WORKBENCH_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-valid-test-key",
    });
    const registry = new ProviderRegistry();

    const meta = registry.getMetadata("openai");
    expect(meta).toBeDefined();
    expect(meta!.status).toBe("connected");
  });
});
