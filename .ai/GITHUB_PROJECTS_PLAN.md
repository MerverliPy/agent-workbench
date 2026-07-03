# GitHub Projects Plan — AI Mobile Command Center

## Project name

AI Mobile Command Center

## Purpose

Track Hermes, Hermex, GitHub, OpenCode, terminal, and mobile development work from one board.

## Recommended fields

| Field | Type | Values |
|---|---|---|
| Repo | Single select | agent-workbench, hermes-webui, scripts, opencode |
| Agent | Single select | Hermes, OpenCode, Manual, Review |
| Risk | Single select | Safe, Needs Review, Dangerous |
| Device | Single select | iPhone, WSL, GitHub Actions, PC |
| Status | Single select | Inbox, Ready, Running, Blocked, Review, Done |
| Next Command | Text | Exact next command or /opencode comment |
| Context Health | Single select | Green, Yellow, Red |

## Automation rules

- New issue → Inbox
- PR opened → Review
- PR merged → Done
- Failed workflow → Blocked
- Label `agent-task` → Ready
- Label `dangerous` → Needs manual review

## Mobile usage

- Hermex: task creation and summaries
- GitHub Mobile: approval, review, merge
- Termius/Moshi: manual terminal execution
- GitHub Actions: verification
