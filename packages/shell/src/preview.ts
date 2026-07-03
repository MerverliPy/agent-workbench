import type { RiskLevel } from "@agent-workbench/protocol";
import type { CommandPreview } from "./types";

const DESTRUCTIVE_PATTERNS: readonly string[] = [
  "rm -rf",
  "rm -fr",
  "sudo rm",
  "chmod -r",
  "chown -r",
  "mkfs",
  "dd",
  "git reset --hard",
  "git clean -f",
  "git push --force",
  "git push -f",
  "truncate",
  "shred",
  "curl|sh",
  "wget|sh",
  "| sh",
  "| bash",
];

const LOW_RISK_COMMANDS = new Set([
  "echo",
  "pwd",
  "whoami",
  "date",
  "uname",
  "hostname",
  "id",
  "env",
  "printenv",
  "true",
  "false",
]);

const MEDIUM_RISK_COMMANDS = new Set([
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "sort",
  "uniq",
  "find",
  "which",
  "type",
  "git",
  "bun",
  "node",
  "npm",
  "npx",
  "tsc",
  "tsx",
  "cargo",
  "rustc",
  "go",
  "python",
  "python3",
  "pip",
  "pip3",
  "make",
  "cmake",
  "gcc",
  "g++",
  "clang",
  "clang++",
  "mkdir",
  "touch",
  "cp",
  "mv",
  "ln",
  "diff",
  "patch",
  "tar",
  "zip",
  "unzip",
  "gzip",
  "gunzip",
  "curl",
  "wget",
  "ping",
  "nslookup",
  "dig",
  "ssh",
  "scp",
  "rsync",
  "docker",
  "kubectl",
  "helm",
  "pg_isready",
  "sqlite3",
  "psql",
  "mysql",
]);

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else if (ch === "\\" && i + 1 < raw.length) {
        i++;
        current += raw[i];
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\n") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function extractBaseBinary(tokens: string[]): string {
  if (tokens.length === 0) return "";

  let i = 0;
  while (
    i < tokens.length - 1 &&
    (tokens[i]?.match(/^[A-Z_]+[A-Z0-9_]*=/) !== null ||
      tokens[i]?.includes("=")) &&
    !tokens[i]?.includes(" ")
  ) {
    i++;
  }

  const raw = tokens[i];
  if (raw === undefined) return "";

  const slashIdx = raw.lastIndexOf("/");
  return slashIdx >= 0 ? raw.slice(slashIdx + 1) : raw;
}

function classifyRisk(
  baseBinary: string,
  command: string,
): {
  riskLevel: RiskLevel;
  matchedRules: string[];
} {
  const lower = command.toLowerCase();

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        riskLevel: "critical",
        matchedRules: [pattern],
      };
    }
  }

  if (lower.includes("curl | sh") || lower.includes("curl|sh")) {
    return {
      riskLevel: "critical",
      matchedRules: ["curl|sh"],
    };
  }
  if (lower.includes("wget | sh") || lower.includes("wget|sh")) {
    return {
      riskLevel: "critical",
      matchedRules: ["wget|sh"],
    };
  }

  if (LOW_RISK_COMMANDS.has(baseBinary)) {
    return {
      riskLevel: "low",
      matchedRules: [],
    };
  }

  if (MEDIUM_RISK_COMMANDS.has(baseBinary)) {
    return {
      riskLevel: "medium",
      matchedRules: [],
    };
  }

  return {
    riskLevel: "high",
    matchedRules: [],
  };
}

export function previewCommand(
  rawCommand: string,
  cwd: string,
): CommandPreview {
  const tokens = tokenize(rawCommand);
  const baseBinary = extractBaseBinary(tokens);
  const normalized = tokens.join(" ");
  const { riskLevel, matchedRules } = classifyRisk(baseBinary, rawCommand);

  return {
    rawCommand,
    normalized,
    cwd,
    baseBinary,
    riskLevel,
    matchedRules,
    requiresApproval: riskLevel !== "low",
  };
}
