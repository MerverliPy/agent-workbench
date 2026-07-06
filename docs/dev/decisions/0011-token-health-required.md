# 0011 — Token Health Is Required

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Long coding-agent sessions can fail or degrade when context grows through messages, tool outputs, diffs, and summaries.

## Decision

Token health is a required system, not an optional enhancement.

It must include:

```text
tool-output truncation
session summarization
context budget calculator
```

## Rationale

The system must remain usable in long sessions and avoid silent context failure or excessive token usage.

## Consequences

### Positive

```text
[+] Better long-session reliability.
[+] More predictable context usage.
[+] Less wasted model input.
[+] User-visible compaction state.
```

### Negative / Tradeoffs

```text
[-] Token counting can be approximate.
[-] Summaries may lose details if poorly designed.
[-] Provider usage reporting varies.
```

## Implementation Rules

```text
[ ] Tool outputs must be compressed/truncated.
[ ] Context budget must be calculated or estimated.
[ ] Compaction must be suggested with user approval by default.
[ ] Token health must be visible in TUI.
[ ] Summaries must avoid secrets.
```

## Boundaries

`packages/tokens` owns token-health logic. TUI renders token-health state only. Core uses token-health outputs during context building.

## Risks

```text
[ ] Summary quality may be poor.
[ ] Token estimates may be inaccurate.
[ ] Silent compaction would damage user trust.
```

## Validation Checklist

```text
[ ] Context budget calculator exists.
[ ] Tool truncation exists.
[ ] Session summarization exists.
[ ] Compaction suggestion exists.
[ ] Token-health panel exists.
```

## Notes for Future Agents

Do not wait for model failures before designing context health.
