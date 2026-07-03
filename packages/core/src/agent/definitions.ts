import type { AgentProfile } from "./types";

export const BUILD_AGENT: AgentProfile = {
  id: "build",
  name: "Build",
  mode: "build",
  description: "Main implementation agent for coding tasks.",
  capabilities: [
    "read",
    "grep",
    "glob",
    "write",
    "edit",
    "apply_patch",
    "diff_preview",
    "revert_last_change",
    "bash",
  ],
  permissionProfile: [
    { toolName: "read", outcome: "allow" },
    { toolName: "grep", outcome: "allow" },
    { toolName: "glob", outcome: "allow" },
    { toolName: "diff_preview", outcome: "allow" },
    { toolName: "write", outcome: "ask" },
    { toolName: "edit", outcome: "ask" },
    { toolName: "apply_patch", outcome: "ask" },
    { toolName: "revert_last_change", outcome: "ask" },
    { toolName: "bash", outcome: "ask" },
  ],
  promptVersion: "1.0.0",
  systemPrompt: `You are a build agent. Your role is to implement software engineering tasks: read and analyze code, propose and apply edits, execute shell commands for development workflows, and maintain task progress.

When working on tasks:
- Read relevant files before making changes.
- Propose minimal, targeted edits.
- Apply patches with diff preview when possible.
- Ask for permission before destructive or risky operations.
- Report progress and any issues encountered.

You must never bypass permission checks. File mutations and shell commands require user approval by default.`,
};

export const PLAN_AGENT: AgentProfile = {
  id: "plan",
  name: "Plan",
  mode: "plan",
  description:
    "Planning, analysis, and implementation strategy before mutation.",
  capabilities: ["read", "grep", "glob", "diff_preview", "bash"],
  permissionProfile: [
    { toolName: "read", outcome: "allow" },
    { toolName: "grep", outcome: "allow" },
    { toolName: "glob", outcome: "allow" },
    { toolName: "diff_preview", outcome: "allow" },
    { toolName: "bash", outcome: "ask" },
    { toolName: "write", outcome: "deny" },
    { toolName: "edit", outcome: "deny" },
    { toolName: "apply_patch", outcome: "deny" },
    { toolName: "revert_last_change", outcome: "deny" },
  ],
  promptVersion: "1.0.0",
  systemPrompt: `You are a planning agent. Your role is to analyze, plan, and design implementation strategies before any code changes are made.

When working on tasks:
- Read and analyze the codebase thoroughly.
- Identify architecture patterns, risks, and dependencies.
- Create structured implementation plans with clear steps.
- Evaluate tradeoffs and surface unknowns.
- You may use shell commands for analysis (e.g., listing files, running tests), but only with user approval.

You must NOT mutate files. Your purpose is planning and analysis only. Switch to the Build agent when ready to implement changes.`,
};

export const ALL_AGENTS: ReadonlyMap<AgentProfile["id"], AgentProfile> =
  new Map([
    ["build", BUILD_AGENT],
    ["plan", PLAN_AGENT],
  ]);
