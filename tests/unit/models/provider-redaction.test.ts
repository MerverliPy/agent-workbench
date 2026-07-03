/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import {
  redactApiKey,
  redactAuthorizationHeader,
  redactError,
  redactHeaders,
  redactString,
} from "@agent-workbench/models";

describe("redactApiKey", () => {
  it("redacts a long API key, keeping prefix and suffix", () => {
    const result = redactApiKey("sk-1234567890abcdef");
    expect(result).toBe("sk-1...cdef");
    expect(result).not.toContain("1234567890");
  });

  it("returns *** for short keys (<= 8 chars)", () => {
    expect(redactApiKey("short")).toBe("***");
    expect(redactApiKey("12345678")).toBe("***");
  });
});

describe("redactAuthorizationHeader", () => {
  it("redacts Bearer token", () => {
    expect(redactAuthorizationHeader("Bearer sk-secret-token-value")).toBe(
      "Bearer ***",
    );
  });

  it("handles multiple Bearer tokens", () => {
    expect(redactAuthorizationHeader("Bearer abc123 Bearer def456")).toBe(
      "Bearer *** Bearer ***",
    );
  });

  it("returns empty string unchanged", () => {
    expect(redactAuthorizationHeader("")).toBe("");
  });
});

describe("redactString", () => {
  it("redacts Bearer tokens from strings", () => {
    const input = "Authorization: Bearer abc123xyz";
    const result = redactString(input);
    expect(result).not.toContain("abc123xyz");
    expect(result).toContain("Bearer ***");
  });

  it("redacts API-key-like patterns", () => {
    const input = "key: sk-abcdefghijklmno12345";
    const result = redactString(input);
    expect(result).not.toContain("sk-abcdefghijklmno12345");
    expect(result).toContain("***");
  });
});

describe("redactHeaders", () => {
  it("redacts Authorization header values", () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer secret-token-here",
      "X-Request-Id": "abc-123",
    };
    const result = redactHeaders(headers);
    expect(result.Authorization).toBe("Bearer ***");
    expect(result["Content-Type"]).toBe("application/json");
    expect(result["X-Request-Id"]).toBe("abc-123");
  });

  it("handles case-insensitive auth header key", () => {
    const headers = {
      authorization: "Bearer my-token",
    };
    const result = redactHeaders(headers);
    expect(result.authorization).toBe("Bearer ***");
  });
});

describe("redactError", () => {
  it("redacts Bearer token from error message", () => {
    const err = new Error("Request failed: Bearer sk-secret-key-123");
    const result = redactError(err);
    expect(result.message).not.toContain("sk-secret-key-123");
    expect(result.message).toContain("Bearer ***");
  });

  it("redacts explicit API key from error message", () => {
    const apiKey = "sk-my-real-api-key-12345";
    const err = new Error(`Failed auth with key: ${apiKey}`);
    const result = redactError(err, apiKey);
    expect(result.message).not.toContain(apiKey);
    expect(result.message).toContain("sk-m...2345");
  });

  it("redacts API key from error stack", () => {
    const apiKey = "sk-stack-key-abcdef";
    const err = new Error(`Error involving ${apiKey}`);
    err.stack = `Error: Error involving ${apiKey}\n    at foo (test.ts:1:1)`;
    const result = redactError(err, apiKey);
    if (result.stack !== undefined) {
      expect(result.stack).not.toContain(apiKey);
    }
  });

  it("preserves error name", () => {
    const err = new Error("test");
    err.name = "CustomError";
    const result = redactError(err);
    expect(result.name).toBe("CustomError");
  });

  it("redacts deeply in cause chain", () => {
    const innerKey = "sk-inner-secret";
    const inner = new Error(`inner error: ${innerKey}`);
    const outer = new Error("outer error");
    outer.cause = inner;
    const result = redactError(outer, innerKey);
    const cause = result.cause as Error;
    expect(cause.message).not.toContain(innerKey);
  });
});
