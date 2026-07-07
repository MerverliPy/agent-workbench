# 31 — Phase 31: CI/CD Integration

**Status:** In progress
**Document type:** phase plan
**Dependencies:** Phase 30 (compliance), Phase 26 (plugin system)
**Estimated:** 1 week

---

## Purpose

Integrate agent-workbench with CI/CD workflows — PR review automation, changelog generation, and automated PR descriptions. These tools make agent-workbench part of the development lifecycle rather than just a local assistant.

---

## Required Outputs

### CLI Commands (apps/cli)

```
apps/cli/src/commands/
  ├── review.ts           # PR review bot — analyze diff, post findings
  ├── changelog.ts        # Changelog generator from conventional commits
  └── pr-describe.ts      # PR description generator from commit log
```

### GitHub Integration

- `agent-workbench review --pr <number>` — Fetches PR diff, runs type-check + lint on changed files, posts structured review comment via `gh pr review`
- `agent-workbench changelog` — Parses `git log` for conventional commits, groups by type (feat/fix/docs/etc), outputs markdown
- `agent-workbench pr-describe` — Generates PR description with commit summary, type emoji, co-authors, and checklist from commit history

### Workflow Templates (future)

- `.github/workflows/agent-review.yml` — GitHub Action that runs review on PR
- `.github/workflows/agent-changelog.yml` — Generate changelog on release tag

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  agent-workbench CLI                         │
│                                              │
│  main() ──► plugin / init / review /         │
│             changelog / pr-describe          │
│                                              │
│  review ──► gh CLI ──► fetch PR diff         │
│           ──► tsc + biome ──► analyze        │
│           ──► gh pr review ──► post          │
│                                              │
│  changelog ──► git log ──► parse commits     │
│            ──► group by type ──► output md   │
│                                              │
│  pr-describe ──► git log ──► parse commits   │
│              ──► generate template ──► out   │
└─────────────────────────────────────────────┘
```

All commands use:
- `gh` CLI for GitHub API access (authenticated via user's existing `gh` auth)
- `git` for local commit history
- `npx` for analysis tools (tsc, biome)
- Node.js `child_process.execSync` for subprocess calls

---

## Exit Gates

```
[x] PR review command: analyze diff and post structured review
[x] Changelog command: generate markdown from conventional commits
[x] PR describe command: generate description from commit history
[x] Unit tests for parsing and formatting logic (8+ tests across all commands)
[x] All commands build and type-check cleanly
[x] GitHub Action workflow template for automated PR review
[x] GitHub Action workflow template for release changelog
```

---

## Risks

- `gh` CLI must be installed and authenticated — commands fail gracefully with clear error message
- `npx` execution is slow for single-file type-checking — may need optimization for large diffs
- Diff parsing is regex-based and may miss edge cases (binary files, large renames)
- Commands are synchronous — fine for CLI, but future GitHub Actions would need async

---

## Changes Already Made

| File | Change |
|------|--------|
| `apps/cli/src/commands/review.ts` | New — PR review bot with diff parsing, type-check, biome lint, `gh pr review` posting |
| `apps/cli/src/commands/changelog.ts` | New — Changelog generator from conventional commits |
| `apps/cli/src/commands/pr-describe.ts` | New — PR description generator from commit log |
| `apps/cli/src/commands/cli-cicd.test.ts` | New — 8 unit tests for parsing and formatting |
| `apps/cli/src/index.ts` | Updated — added `review`, `changelog`, `pr-describe` commands |

---

*Last updated: 2026-07-07*
