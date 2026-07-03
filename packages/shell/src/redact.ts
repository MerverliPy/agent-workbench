const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b[A-Z][A-Z0-9_]{2,}=[^\s]{8,}/g, label: "env-var-value" },
  { pattern: /\bsk-[a-zA-Z0-9]{20,}/g, label: "openai-key" },
  { pattern: /\bghp_[a-zA-Z0-9]{20,}/g, label: "github-token" },
  { pattern: /\bgho_[a-zA-Z0-9]{20,}/g, label: "github-oauth" },
  { pattern: /\bghu_[a-zA-Z0-9]{20,}/g, label: "github-user" },
  { pattern: /\bg[sr]_[a-zA-Z0-9]{20,}/g, label: "github-installation" },
  { pattern: /Bearer\s+[A-Za-z0-9\-_.]{20,}/g, label: "bearer-token" },
  { pattern: /xox[bpras]-[a-zA-Z0-9-]{10,}/g, label: "slack-token" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, label: "aws-access-key" },
  {
    pattern: /\b([a-z0-9]+\.)?[a-z0-9]+\.co_\[[a-zA-Z0-9]{20,}\]/g,
    label: "jwt",
  },
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern } of SECRET_PATTERNS) {
    result = result.replace(pattern, "***REDACTED***");
  }
  return result;
}
