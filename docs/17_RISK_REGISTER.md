# 17 — Risk Register

Status: Planning artifact (Phase 0 origin); reviewed through Phase 14B
Document type: agent-ready risk register
Scope: architectural, security, implementation, UX, data, and operational risks

## 1. Purpose

This document tracks known risks for `agent-workbench`.

Future agents must consult this file before implementation. Do not silently resolve risks by assumption. Update this register when new risks are discovered.

## 2. Risk Status Values

Use these statuses:

```text
open
mitigated
accepted
deferred
needs confirmation
```

## 3. Risk Severity Values

Use these severities:

```text
low
medium
high
critical
```

## 4. Risk Register

| ID | Risk | Severity | Status | Mitigation |
|---|---|---:|---|---|
| RISK-001 | Phase 0 accidentally creates implementation files. | High | Open | Enforce Phase 0 file boundary: only README.md, docs/, decisions/. |
| RISK-002 | TUI becomes a monolithic app that executes tools directly. | Critical | Open | Enforce TUI thin-client import rules. |
| RISK-003 | Shell execution runs before permission engine exists. | Critical | Open | Phase order forbids shell before Phase 10 and permissions before Phase 8. |
| RISK-004 | File mutation runs before diff preview exists. | Critical | Open | Patch-first mutation and approval required by default. |
| RISK-005 | Server accidentally binds to LAN/remote interface. | Critical | Open | Localhost-only default and middleware required. |
| RISK-006 | Provider secrets stored in plaintext. | Critical | Open | Use environment-variable references by default; no plaintext secret storage. |
| RISK-007 | Permission prompts become cosmetic and can be bypassed. | Critical | Open | Backend permission engine must block execution until decision. |
| RISK-008 | Model decides command safety without deterministic rules. | High | Open | Use command risk classifier + explicit rules. |
| RISK-009 | Ledger stores secrets from command output or files. | High | Open | Add redaction, truncation, and sensitive path policy. |
| RISK-010 | Cache serves stale file/search results after mutation. | High | Open | Invalidate cache on edit/write/patch/delete/rename. |
| RISK-011 | Cache returns content that is no longer permitted. | High | Open | Re-check permission/path policy before returning cached content. |
| RISK-012 | Token compaction loses critical project facts. | High | Open | Summary quality checks and user-approved compaction. |
| RISK-013 | Token output grows without control. | High | Open | Structured compression and context budget calculator. |
| RISK-014 | Route contracts drift from TUI/SDK types. | High | Open | Zod-first protocol package and generated/derived SDK. |
| RISK-015 | Database schema becomes API contract. | Medium | Open | Keep storage schema separate from protocol schemas. |
| RISK-016 | Subagents are added too early and increase complexity. | Medium | Open | Build + Plan only initially; no subagents. |
| RISK-017 | Full PTY is implemented too early. | Medium | Open | Simple command runner first; PTY design later. |
| RISK-018 | TUI hides risk details for approvals. | High | Open | Permission modal must show risk, command/path/diff/dry-run details. |
| RISK-019 | Tests rely on real provider API keys. | Medium | Open | Use fake model provider adapters for normal tests. |
| RISK-020 | Generated docs invent unresolved decisions. | Medium | Open | Mark unresolved items explicitly. |
| RISK-021 | Dependency APIs change before implementation. | Medium | Open | Verify current APIs before writing code. |
| RISK-022 | Local database retention grows indefinitely. | Medium | Open | Define deletion/retention policy later. |
| RISK-023 | Session deletion semantics are unclear. | Medium | Open | Resolve in data/API design before implementation. |
| RISK-024 | Sensitive paths are under-specified. | High | Open | Define path policy before read tools are broad. |
| RISK-025 | Destructive command patterns are incomplete. | High | Open | Expand command risk rules in Phase 10. |
| RISK-026 | Dry-run preview is mistaken for actual safety guarantee. | Medium | Open | UI and docs must state dry-run limitations. |
| RISK-027 | TUI event stream is treated as authoritative state. | Medium | Open | Authoritative state remains server/core/storage. |
| RISK-028 | Error messages leak secrets. | High | Open | Structured error envelope and redaction. |
| RISK-029 | Remote access is added without auth review. | Critical | Open | Remote/LAN access requires explicit future confirmation. |
| RISK-030 | Build/Plan prompts are poorly specified. | Medium | Open | Write versioned agent prompts during Phase 11. |

## 5. Critical Risks

Critical risks require explicit mitigation before implementation reaches affected phase:

```text
RISK-002 TUI executes tools directly
RISK-003 Shell before permissions
RISK-004 Mutation before diff preview
RISK-005 Server exposed remotely
RISK-006 Plaintext secrets
RISK-007 Cosmetic permissions
RISK-029 Remote access without auth review
```

## 6. Cross-Cutting Mitigations

### Phase Order

Use phase order to prevent dangerous sequencing:

```text
permissions before mutation
permissions before shell
schemas before routes
TUI shell before runtime coupling
storage before full audit dependency
```

### Boundaries

Use package boundaries to prevent authority leaks:

```text
TUI cannot import tools/shell/storage
server validates requests
core owns runtime
permissions own decisions
storage owns persistence
```

### Auditability

Use run ledger to preserve visibility:

```text
tool calls
permission decisions
file changes
shell commands
dry-runs
token compaction
cache invalidation
```

## 7. Unknowns That Carry Risk

| ID | Unknown | Risk |
|---|---|---|
| UNK-001 | Exact auth mechanism | Server exposure risk if later remote mode added. |
| UNK-002 | Exact sensitive path policy | Secret leakage risk. |
| UNK-003 | Exact destructive command list | Unsafe shell execution risk. |
| UNK-004 | Exact token counting method | Context failure or cost misreporting. |
| UNK-005 | Exact cache persistence policy | Privacy/staleness risk. |
| UNK-006 | Exact DB retention policy | Disk growth/privacy risk. |
| UNK-007 | Exact dependency APIs | Implementation drift risk. |

## 8. Agent Instructions

Future agents must:

1. Check this risk register before implementing a phase.
2. Do not remove risks without mitigation evidence.
3. Add new risks when discovered.
4. Mark risk status changes explicitly.
5. Treat critical open risks as blockers for affected phases.
6. Avoid inventing resolutions.

## 9. Validation Checklist

```text
[ ] Critical risks are identified.
[ ] Security risks are documented.
[ ] Implementation sequencing risks are documented.
[ ] Data/privacy risks are documented.
[ ] Mitigations are listed.
[ ] Unknowns are marked.
```
