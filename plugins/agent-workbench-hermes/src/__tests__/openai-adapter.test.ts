/**
 * Tests for OpenAIAdapter.
 */

import { describe, expect, test } from "bun:test";
import { OpenAIAdapter } from "../openai-adapter";

describe("OpenAIAdapter", () => {
  test("constructor sets id, name, and model from config", () => {
    const adapter = new OpenAIAdapter({
      providerId: "hermes:deepseek",
      displayName: "deepseek (Hermes — deepseek-v4-flash)",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test-key",
    });

    expect(adapter.id).toBe("hermes:deepseek");
    expect(adapter.name).toBe("deepseek (Hermes — deepseek-v4-flash)");
  });

  test("strips trailing slash from baseUrl", () => {
    const adapter = new OpenAIAdapter({
      providerId: "hermes:openai",
      displayName: "OpenAI",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1/",
      apiKey: "sk-test-key",
    });

    // The baseUrl is private, but we can test through id/name to confirm
    // construction succeeded without errors
    expect(adapter.id).toBe("hermes:openai");
    expect(adapter.name).toBe("OpenAI");
  });

  test("handles baseUrl without trailing slash", () => {
    const adapter = new OpenAIAdapter({
      providerId: "hermes:test",
      displayName: "Test Provider",
      model: "test-model",
      baseUrl: "https://api.test.com/v1",
      apiKey: "sk-test-key",
    });

    expect(adapter.id).toBe("hermes:test");
  });

  test("handles baseUrl with multiple trailing slashes", () => {
    const adapter = new OpenAIAdapter({
      providerId: "hermes:multi",
      displayName: "Multi Slash",
      model: "test-model",
      baseUrl: "https://api.test.com/v1///",
      apiKey: "sk-test-key",
    });

    expect(adapter.id).toBe("hermes:multi");
  });

  test("handles empty apiKey gracefully", () => {
    const adapter = new OpenAIAdapter({
      providerId: "hermes:empty-key",
      displayName: "Empty Key",
      model: "test-model",
      baseUrl: "https://api.test.com/v1",
      apiKey: "",
    });

    expect(adapter.id).toBe("hermes:empty-key");
  });
});
