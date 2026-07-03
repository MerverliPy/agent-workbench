/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import {
  ProviderConfigError,
  parseProviderConfig,
} from "@agent-workbench/models";

describe("parseProviderConfig", () => {
  it("throws ProviderConfigError when AGENT_WORKBENCH_PROVIDER is not set", () => {
    expect(() => parseProviderConfig({})).toThrow(ProviderConfigError);
    expect(() => parseProviderConfig({})).toThrow(
      "AGENT_WORKBENCH_PROVIDER is not set",
    );
  });

  it("throws ProviderConfigError when provider is set but OPENAI_API_KEY is missing", () => {
    expect(() =>
      parseProviderConfig({
        AGENT_WORKBENCH_PROVIDER: "openai",
      }),
    ).toThrow(ProviderConfigError);
    expect(() =>
      parseProviderConfig({
        AGENT_WORKBENCH_PROVIDER: "openai",
      }),
    ).toThrow("requires OPENAI_API_KEY");
  });

  it("returns config with defaults when provider and key are set", () => {
    const env = {
      AGENT_WORKBENCH_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-key",
    };
    const config = parseProviderConfig(env);
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4o");
    expect(config.apiKey).toBe("sk-test-key");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("uses AGENT_WORKBENCH_MODEL when set", () => {
    const env = {
      AGENT_WORKBENCH_PROVIDER: "openai",
      AGENT_WORKBENCH_MODEL: "gpt-4o-mini",
      OPENAI_API_KEY: "sk-test-key",
    };
    const config = parseProviderConfig(env);
    expect(config.model).toBe("gpt-4o-mini");
  });

  it("uses OPENAI_BASE_URL when set", () => {
    const env = {
      AGENT_WORKBENCH_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_BASE_URL: "https://custom.openai.example.com/v1",
    };
    const config = parseProviderConfig(env);
    expect(config.baseUrl).toBe("https://custom.openai.example.com/v1");
  });

  it("accepts openai-compatible as provider id", () => {
    const env = {
      AGENT_WORKBENCH_PROVIDER: "openai-compatible",
      OPENAI_API_KEY: "sk-test-key",
    };
    const config = parseProviderConfig(env);
    expect(config.provider).toBe("openai-compatible");
  });

  it("trims whitespace from env values", () => {
    const env = {
      AGENT_WORKBENCH_PROVIDER: "  openai  ",
      OPENAI_API_KEY: "  sk-test-key  ",
    };
    const config = parseProviderConfig(env);
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("sk-test-key");
  });
});
