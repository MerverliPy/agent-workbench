import type { TokenCountEstimate } from "./types";

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): TokenCountEstimate {
  return {
    tokenCount: Math.ceil(text.length / CHARS_PER_TOKEN),
    isEstimate: true,
    method: "char_div_4",
  };
}

export function estimateTokensFromLength(length: number): number {
  return Math.ceil(length / CHARS_PER_TOKEN);
}

export function providerReportedTokens(count: number): TokenCountEstimate {
  return {
    tokenCount: count,
    isEstimate: false,
    method: "provider_reported",
  };
}
