# Security Model

agent-workbench operates in your local development environment, reading files, editing them, running shell commands, and calling AI model providers. This document describes the security architecture that constrains these capabilities by default.

## 1. Purpose

This document defines the security model for `agent-workbench`.

The system executes in a local developer environment and may eventually read files, edit files, run shell commands, and call model providers. These capabilities are powerful and must be constrained by default.

## 2. Security Goals

The system must:

```text
protect local files
protect secrets
prevent unintended shell execution
prevent unintended file mutation
keep server local by default
make risky actions visible
make risky actions auditable
allow user control over approvals
avoid silent destructive behavior
```

## 3. Threat Model

### Assets

Assets include:

```text
source code
project files
environment variables
provider API keys
local credentials
git history
private configuration
shell access
database/session history
agent prompts and responses
tool outputs
```

### Threats

Potential threats include:

```text
model proposes unsafe command
model proposes destructive file edit
tool reads sensitive file
shell command exfiltrates secrets
server exposed beyond localhost
TUI bypasses backend policy
permission prompt hides risk
cache serves stale or sensitive data
run ledger stores secrets accidentally
dependency behavior changes
```

## 4. Localhost-Only Server Default

The server must bind to localhost by default.

Confirmed default:

```text
127.0.0.1 only
```

Do not expose the server to LAN or remote interfaces without explicit configuration and future security review.

### Requirements

```text
[ ] Default bind address is localhost.
[ ] LAN/remote binding is disabled by default.
[ ] CORS is restrictive by default.
[ ] Auth hooks exist before remote access is considered.
[ ] Logs clearly show bind address.
```

## 5. Secret Handling

Confirmed default:

```text
Do not store secrets in plaintext.
Prefer environment-variable references for provider secrets.
```

### Secret Sources

Potential secret sources:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_API_KEY
provider tokens
local auth token
project .env files
SSH keys
cloud credentials
```

### Requirements

```text
[ ] Provider secrets are resolved from environment variables by default.
[ ] Secrets are not written to run ledger.
[ ] Secrets are redacted from tool outputs where possible.
[ ] Sensitive files are denied or ask-gated.
[ ] Plaintext secret storage is not implemented by default.
```

### Unresolved

Encrypted local secret storage is unresolved and requires confirmation.

## 6. File Safety

File reads and writes have different risk levels.

### Read Safety

Read-only tools are allowed by default for normal project files:

```text
read: allow
grep: allow
glob: allow
```

However, sensitive file paths should be denied or ask-gated.

Provisional sensitive paths:

```text
.env
.env.*
*.pem
*.key
*.p12
.ssh/**
.git/**
```

### Mutation Safety

File mutation tools default to ask:

```text
edit: ask
write: ask
apply_patch: ask
```

Mutation requirements:

```text
[ ] Permission check required.
[ ] Diff preview required.
[ ] User approval required by default.
[ ] File change ledger record required.
[ ] Revert path required where possible.
```

## 7. Shell Safety

Shell execution is high-risk.

Confirmed first shell model:

```text
simple command runner first
full PTY later
```

Default posture:

```text
bash: ask
destructive commands: deny unless explicitly configured
```

### Shell Requirements

```text
[ ] Parse command before execution.
[ ] Classify command risk.
[ ] Evaluate command permissions.
[ ] Show command preview when ask-gated.
[ ] Support timeout.
[ ] Support abort.
[ ] Stream stdout/stderr.
[ ] Truncate or summarize excessive output.
[ ] Record shell ledger events.
```

### Commands That Need High Scrutiny

Provisional examples:

```text
rm -rf
git reset --hard
git clean -fd
git push
git push --force
curl | sh
wget | sh
sudo
chmod -R
chown -R
delete/move operations
package installs
database migrations
```

Exact list is unresolved.

## 8. TUI Trust Boundary

The TUI is untrusted for privileged execution.

The TUI must not:

```text
run shell commands
write files
apply patches
call model providers directly
decide permission policy
persist source-of-truth state
modify SQLite directly
```

The TUI may:

```text
render permission requests
send approval/deny responses
display diffs
display ledger
display token-health state
submit prompts through SDK
```

## 9. API Security

The local API must:

```text
[ ] Validate every request with protocol schemas.
[ ] Return structured errors.
[ ] Use restrictive CORS by default.
[ ] Bind localhost by default.
[ ] Avoid exposing sensitive data in errors.
[ ] Support future local auth token if needed.
```

Open questions:

```text
exact local auth mechanism
whether localhost mode requires token
whether browser clients are allowed
```

## 10. Run Ledger Security

The run ledger is required for auditability but may contain sensitive content.

Ledger requirements:

```text
[ ] Record risky operations.
[ ] Redact secrets where possible.
[ ] Avoid storing raw full command output when unnecessary.
[ ] Store summaries for oversized outputs.
[ ] Record metadata for audit.
[ ] Do not store provider keys.
```

Potential ledger risk:

```text
A complete ledger can accidentally preserve secrets from command output or file content.
```

Mitigation:

```text
redaction hooks
sensitive path policy
output truncation
explicit user controls later
```

## 11. Cache Security

Read/search cache improves efficiency but can preserve stale or sensitive data.

Requirements:

```text
[ ] Cache must be session-scoped initially.
[ ] Cache must invalidate on file mutation.
[ ] Cache must respect sensitive path policy.
[ ] Cache entries must not outlive intended scope without confirmation.
[ ] Cache hits/misses should be ledgered or observable for debugging.
```

Exact cache retention policy is unresolved.

## 12. Token-Health Security

Token compression and summarization can accidentally leak or preserve sensitive facts.

Requirements:

```text
[ ] Summaries must avoid storing secrets.
[ ] Tool outputs should be redacted before summarization where possible.
[ ] Compaction should be suggested with user approval.
[ ] Important project facts must be preserved.
[ ] User should see token-health status.
```

## 13. Model Provider Security

Model providers are external services unless using local models.

Requirements:

```text
[ ] Do not send sensitive files unless requested and permitted.
[ ] Respect file/path permission rules before including content.
[ ] Do not include secrets in prompts intentionally.
[ ] Track model calls in run ledger.
[ ] Capture token/cost metadata where available.
```

Unresolved:

```text
first provider list
provider-specific privacy warnings
local model support priority
```

## 14. Dry-Run Security

Dry-run preview is required for:

```text
file edits
shell command preview
```

Dry-run must not become a bypass. Previewing is not permission to execute.

Requirements:

```text
[ ] Dry-run result is separate from execution.
[ ] Approval still required for ask-gated operations.
[ ] Dry-run output is ledgered.
[ ] Dry-run cannot mutate project state.
```

## 15. Security Acceptance Criteria

The security model is satisfied when:

```text
[ ] Server is localhost-only by default.
[ ] TUI cannot execute privileged operations.
[ ] API validates all inputs.
[ ] Secrets are not stored in plaintext by default.
[ ] File mutation requires permission and diff preview.
[ ] Shell execution requires permission and risk classification.
[ ] Destructive commands default to deny.
[ ] Risky actions are ledgered.
[ ] Token/caching systems do not silently preserve secrets.
```

## 16. Phase-Specific Security Gates

### Phase 0

```text
[ ] Security model documented.
[ ] No implementation files created.
```

### Phase 3

```text
[ ] Server binds localhost by default.
[ ] CORS restrictive by default.
[ ] Request validation exists.
```

### Phase 5

```text
[ ] Secret storage policy enforced.
[ ] Ledger redaction policy planned.
```

### Phase 8

```text
[ ] Permission engine enforced.
[ ] Deny prevents execution.
[ ] Ask pauses execution.
```

### Phase 9

```text
[ ] Mutations require diff preview.
[ ] Mutations are ledgered.
```

### Phase 10

```text
[ ] Shell requires risk classification.
[ ] Shell supports timeout and abort.
[ ] Shell output is controlled.
```

## 17. Anti-Patterns

Do not:

- Bind server to `0.0.0.0` by default.
- Store provider keys in plaintext.
- Allow TUI to execute shell commands.
- Allow model output to apply patches directly.
- Run bash without permission evaluation.
- Treat local environment as safe by default.
- Cache sensitive file contents indefinitely.
- Log full secrets in ledger.
- Add remote access before auth design.
- Let dry-run mutate files.

## 18. Open Questions

| ID | Question | Status |
|---|---|---|
| SEC-001 | Exact local auth mechanism | Unresolved |
| SEC-002 | Exact CORS policy | Unresolved |
| SEC-003 | Encrypted local secret storage | Needs confirmation |
| SEC-004 | Sensitive file/path list | Provisional |
| SEC-005 | Destructive command list | Provisional |
| SEC-006 | Cache retention policy | Unresolved |
| SEC-007 | Telemetry policy | Default no telemetry unless confirmed |

## 19. Agent Instructions

Future agents must:

1. Preserve localhost-only default.
2. Do not add remote access without explicit confirmation.
3. Do not add plaintext secret storage.
4. Do not implement shell before permission engine.
5. Do not implement mutation before diff preview.
6. Redact secrets from logs and ledger where possible.
7. Mark unresolved security choices clearly.

## 20. Validation Checklist

```text
[ ] Localhost-only default is documented.
[ ] Secret handling is documented.
[ ] File safety is documented.
[ ] Shell safety is documented.
[ ] TUI trust boundary is documented.
[ ] Ledger security is documented.
[ ] Cache/token risks are documented.
[ ] Open questions are marked.
```
