# Security & Compliance Audit Report — agent-workbench

**Date:** July 7, 2026  
**Scope:** Full-stack security audit covering CVE posture, dependency vulnerabilities, secret scanning, code injection, permission model, CI/CD, audit trail, PII scanning, SSO, RBAC, FIPS, SBOM, and supply chain security.  
**Repo Path:** ```REPO_ROOT```  
**Previous Audit:** July 3, 2026 (Phase 30 landing — 12 exit gates)

---

## Executive Summary

The agent-workbench codebase demonstrates **strong security awareness** with well-designed foundations in several areas: the compliance package's chain-hashed audit trail, FIPS KAT vectors, PII scanner with three redaction modes, and a stateless permission engine with layered rule evaluation. The Phase 30 enterprise features (SSO, RBAC, FIPS, PII scanner, air-gapped mode, SBOM) are **correctly implemented at the package level** and have solid test coverage.

However, the audit reveals **6 HIGH severity findings** across integration boundaries, missing enforcement, and defensive gaps. The most critical issues are: (1) two separate audit systems exist — one tamper-evident (compliance), one a plain ring buffer (HTTP middleware) — with neither persisted to disk, (2) `noDangerouslySetInnerHtml` is disabled in Biome and actively used in production UI components creating an XSS vector, (3) the SSO implementation hand-rolls RSA/JWKS verification (no EC support), (4) Biome disables `noDangerouslySetInnerHtml` while production TSX files use `innerHTML` directly, (5) data retention has the policy code but no cron/scheduler wiring it to production, and (6) the air-gapped mode is opt-in via a fetch wrapper that nothing in the codebase actually uses by default.

**Overall Security Posture:** B- (Solid foundations, critical integration gaps, 3 unpatched advisories)

---

## HIGH Severity Findings

| # | Finding | File(s) | Line(s) | Impact |
|---|---------|---------|---------|--------|
| H-01 | **Two separate audit logs, neither persisted to disk** | `apps/server/src/middleware/audit-log.ts`, `packages/compliance/src/audit.ts` | audit-log.ts:22-45, audit.ts:52 | The HTTP-level audit middleware uses a plain in-memory ring buffer (no hash chaining, max 1000 entries, no persistence). The compliance `AuditTrail` has proper SHA-256 chaining but exists as a separate class only used in tests. In production, audit entries are lost on restart with zero forensic recoverability. Attackers with process access can silently modify/truncate the in-memory buffer. |
| H-02 | **Biome security rule `noDangerouslySetInnerHtml` disabled + active innerHTML usage** | `biome.json:42`, `apps/mobile-web/src/components/MessageBubble.tsx:100`, `apps/mobile-web/src/components/cards/SummaryCard.tsx:42` | biome.json:42, MessageBubble.tsx:100, SummaryCard.tsx:42 | The biome linter has `noDangerouslySetInnerHtml: "off"` and `renderMarkdown()` output is injected via `innerHTML` in two production TSX components. If `renderMarkdown()` doesn't sanitize output, this is a **stored XSS vector** — any LLM response containing malicious HTML/JS will be executed in the user's browser. |
| H-03 | **SSO middleware hand-rolls RSA JWKS verification — no EC support** | `apps/server/src/middleware/sso-middleware.ts` | 240-244, 167-168 | Only RSA key types are supported (`if (jwk.kty !== "RSA") throw`). Many OIDC providers (Apple, Okta, Microsoft Entra) use EC (P-256/P-384) keys. If an EC-only provider is configured, SSO login is broken. Additionally, `keys.find(k => k.kid === kid)` at line 168 falls back to `keys[0]` when no `kid` is present — this silently accepts any key in the JWKS set, enabling a key-confusion attack if a provider rotates keys. |
| H-04 | **No data retention cron/scheduler wiring** | `packages/compliance/src/data-retention.ts` | 1-79 | The `applyRetention()` function is fully implemented with exempt actions and configurable TTL, but **nothing in the codebase calls it on a schedule**. No cron job, no setInterval, no startup task. This means audit trails grow unbounded and GDPR's "right to erasure" / data minimization requirements are **not actually enforced in production**. |
| H-05 | **Air-gapped mode not wired into server/core — voluntary opt-in only** | `packages/compliance/src/airgap.ts`, `apps/server/src/config.ts`, `packages/core/src/` | airgap.ts:64-86, config.ts:39-49 | `AGENT_WORKBENCH_AIRGAPPED` is checked only when the user explicitly calls `createAirGappedFetch()`. The server's config.ts (line 39-49) does NOT check this env var. The core package has zero references to airgap. In production, setting the env var has **no effect** — providers can still make external API calls because the air-gapped fetch wrapper is never injected as the default fetch implementation. |
| H-06 | **`readAuditLog()` always returns empty array** | `apps/server/src/middleware/audit-log.ts` | 55-57 | The `readAuditLog()` function (meant to expose the audit log for export/debugging) unconditionally returns `[]`. The actual log is a closure variable trapped inside `auditLogMiddleware()` with no accessor. Any monitoring or compliance endpoint calling `readAuditLog()` sees an empty log, creating a false sense of security. |

---

## MEDIUM Severity Findings

| # | Finding | File(s) | Line(s) | Impact |
|---|---------|---------|---------|--------|
| M-01 | **3 unpatched dependency advisories** | `bun audit` output | — | **esbuild MODERATE** (CVE — dev server allows cross-origin reads), **opentelemetry MODERATE** (unbounded memory via W3C Baggage), **babel LOW** (arbitrary file read). All impact workspace packages (promptfoo, drizzle-kit, vite, vite-plugin-solid, vite-plugin-pwa). |
| M-02 | **CODEOWNERS doesn't cover compliance, opencode plugin, or middleware** | `.github/CODEOWNERS` | 1-22 | Paths like `packages/compliance/*`, `apps/server/src/middleware/*`, `plugins/*`, `packages/auth/*` are NOT listed. Only `packages/auth/*` has a rule. Compliance, SSO middleware, and the OpenCode bridge can be changed without review by the listed owner. |
| M-03 | **`AGENT_WORKBENCH_AUTH_SECRET` fallback is a hardcoded placeholder** | `packages/auth/src/auth-manager.ts` | 153-161 | When the env var is unset but auth is enabled, the fallback is `"CHANGE-ME-in-production-use-a-64-char-secret!"`. While this is clearly labeled, a production deploy with a copy-paste error that leaves this value active would have a **known HMAC signing key** — anyone who reads this source can forge tokens. |
| M-04 | **SSO uses in-memory pending auths — lost on restart** | `apps/server/src/middleware/sso-middleware.ts` | 76, 364 | `pendingAuths` is an in-memory Map. If the server restarts between login redirect and callback, the user sees "invalid_state" and must re-authenticate. While this is a usability issue rather than a security vulnerability by itself, it also means no rate limiting on state generation — an attacker could flood `pendingAuths` to cause OOM. |
| M-05 | **PII scanner catches localhost IPs as PII** | `packages/compliance/src/pii-scanner.ts` | 125, 211-215 | IPv4 detection at confidence 0.7 (above the default 0.5 threshold) catches addresses like `127.0.0.1` and `192.168.1.1`. The test at pii-scanner.test.ts:211-214 acknowledges this as expected. In practice, tool output logs containing local development server addresses get redacted, creating confusion. |
| M-06 | **ai-safety.yml grep patterns miss many secret types** | `.github/workflows/ai-safety.yml` | 20-25 | Only 5 patterns: OpenAI key, Anthropic key, GitHub token, Telegram bot token, RSA/SSH private keys. **Misses**: AWS keys (`AKIA*`), Google service account keys, Azure keys, generic hashed patterns (`ghp_`, `gho_`, `ghu_`, `ghs_`), Slack tokens, Discord tokens, npm tokens, SSH keys with BEGIN PRIVATE KEY (OpenSSH format is covered, but `-----BEGIN EC PRIVATE KEY-----` and `-----BEGIN DSA PRIVATE KEY-----` are not). |
| M-07 | **SBOM script uses fragile shell parsing of `bun pm ls --all`** | `scripts/sbom.sh` | 84-103 | The bash loop that parses `bun pm ls --all` output is unreliable for scoped packages (line 96-99). Scoped packages like `@opentelemetry/core` have indeterminate parsing. On line 93 the first `sed 's/@[^@]*$//'` can produce incorrect names. The entire script is 251 lines of shell when a 5-line Node.js script would be more reliable. |
| M-08 | **FIPS module doesn't verify OpenSSL FIPS mode** | `packages/compliance/src/fips.ts` | 170-186 | `isFipsCapable()` only checks algorithm *availability*, not whether OpenSSL is actually running in FIPS mode. On a system where OpenSSL is compiled with FIPS but not in FIPS mode, this function returns `true` even though the FIPS boundary is not enforced. A truly FIPS-compliant check requires reading `/proc/sys/crypto/fips_enabled` or calling `EVP_default_properties_is_fips_enabled()`. |
| M-09 | **Biome disables `noGlobalEval` (currently error) but safety-critical rules missing** | `biome.json` | 41-44 | Only 2 security rules: `noDangerouslySetInnerHtml` (off) and `noGlobalEval` (error). Missing: `useTrustedTypes`, `noDocumentCookie`, `noDocumentWrite`, `noUnsanitized` — all relevant for a TUI/web hybrid that renders LLM output. |
| M-10 | **Permission engine path rules use `*.env` but this pattern does not match `.env`** | `packages/permissions/src/policy.ts` | 108-126 | Three separate path rules: `.env` (exact match), `*.env` (extension glob), `.env.*` (prefix+wildcard). But `*.env` as an extension glob only matches files ending in `.env` (like `local.env`), NOT the actual `.env` file — which is already caught by the first exact-match rule. The `.env.*` pattern correctly matches `.env.local`. This works correctly but is confusing and could be simplified to two rules. |

---

## LOW Severity Findings

| # | Finding | File(s) | Line(s) | Impact |
|---|---------|---------|---------|--------|
| L-01 | **`PermissionGate` has no expiration on pending requests** | `packages/permissions/src/gate.ts` | 18 (comment) | Comment explicitly notes: `PERM-EXPIRY: not implemented`. Pending permission requests block indefinitely if the user's session disconnects. |
| L-02 | **`.env.example` contains commented `KEY=sk-...` pattern** | `.env.example` | 12-14 | The strings `OPENAI_API_KEY=sk-...`, `ANTHROPIC_API_KEY=sk-ant-...`, `OPENROUTER_API_KEY=sk-or-...` while commented, are picked up by simple secret scanners as patterns. |
| L-03 | **`SECURITY.md` declares CI config "out of scope"** | `SECURITY.md` | 46 | "GitHub Actions CI configuration" is explicitly listed as out of scope for security reviews, yet CI config controls secret scanning (ai-safety.yml), build integrity, and dependency updates. |
| L-04 | **SSO middleware test coverage is minimal** | `apps/server/src/middleware/sso-middleware.test.ts` | 1-91 | Only tests error paths (502, 400). No tests for: successful token exchange, JWKS key rotation, EC key types, nonce validation, or session token generation. |
| L-05 | **Data retention `mergeEntries` sorts by timestamp, potentially breaking chain integrity** | `packages/compliance/src/data-retention.ts` | 75-76 | After `mergeEntries`, results are sorted by timestamp. If two entries have identical timestamps (possible with concurrent appends), reordering breaks the `previousHash` chain. |
| L-06 | **No local pre-commit secret scanning** | `package.json` | 66 (lint-staged) | lint-staged runs Biome and typechecking but **no secret scanning** (no gitleaks, no trufflehog, no detect-secrets). Secrets can be committed and pushed without detection. |
| L-07 | **CI workflow doesn't verify lockfile integrity** | `.github/workflows/ci.yml` | 29 | `bun install --frozen-lockfile` is used which is good, but no `bun lockb --verify` or hash check on `bun.lock`. |
| L-08 | **SBOM serial number uses `uuidgen` fallback via md5sum** | `scripts/sbom.sh` | 168 | If `uuidgen` is unavailable, the fallback generates a UUID via `date +%s | md5sum` — deterministic and predictable. |
| L-09 | **Compliance headers CSP includes `'unsafe-inline'` for scripts AND styles** | `apps/server/src/middleware/compliance-headers.ts` | 29-30 | Both `script-src` and `style-src` include `'unsafe-inline'`. While documented as needed for theme init, this weakens CSP against XSS. |
| L-10 | **`SessionToken` max TTL is 24 hours but `AuthManager` doesn't enforce a minimum** | `packages/auth/src/session-tokens.ts:22`, `packages/auth/src/auth-manager.ts:166-175` | session-tokens.ts:22, auth-manager.ts:166-175 | Max is 24h (sensible), but the lower bound check is 60 seconds. A user could set a 60-second token TTL, causing continuous re-authentication. |
| L-11 | **`readOpenCodeConfig()` caches API keys in memory for plugin lifecycle** | `plugins/agent-workbench-opencode/src/opencode-config.ts` | 153, 178, `plugins/agent-workbench-opencode/src/index.ts` | API keys from `~/.local/share/opencode/auth.json` are held in `OpenCodeProviderAdapter` instances for the plugin's lifetime. No zeroization on shutdown. |

---

## Itemized Audit Results

### 1. bun audit — Current Advisories
**Result: 3 advisories (2 MODERATE, 1 LOW)**
- `esbuild` ≤0.24.2 — MODERATE — Dev server allows any website to send requests and read responses (affects vite, drizzle-kit, promptfoo)
- `@opentelemetry/core` <2.8.0 — MODERATE — Unbounded memory allocation via W3C Baggage header (affects promptfoo)
- `@babel/core` ≤7.29.0 — LOW — Arbitrary file read via sourceMappingURL comment (affects vite-plugin-pwa, vite-plugin-solid)

### 2. packages/compliance/audit.ts — SHA-256 Chaining
**Result: ✅ Properly implemented**
- Each entry has a `previousHash` field linking to the prior entry's SHA-256 hash
- `computeHash()` at line 28-38 correctly hashes `timestamp + actor + action + resource + details + previousHash`
- `verify()` at line 83-122 validates every link in the chain and detects tampered content
- Genesis entry must have `previousHash: ""` (enforced)
- Full test coverage (chain integrity, tamper detection, missing entry detection)

### 3. packages/compliance/pii-scanner.ts — PII Patterns
**Result: ✅ Comprehensive, 3 redaction modes**
- **Detects:** email, phone (US), SSN, credit card, IPv4, IPv6, API keys (generic key=value pattern), bearer tokens, URL credentials, date of birth
- **3 redaction modes:** `redact` → `[REDACTED]`, `mask` → shows first 2 + last 2 chars, `hash` → SHA-256 prefix
- **Configurable:** enable/disable patterns, min confidence threshold, mode overrides, custom patterns
- **Gap:** Non-US phone numbers not detected. Date-of-birth pattern has confidence 0.5 (below default threshold) — but `hasPii` is computed after filtering by threshold, so DB patterns are effectively ignored by default

### 4. packages/compliance/fips.ts — KATs and Algorithm Check
**Result: ✅ Solid KATs, ⚠️ Missing OpenSSL FIPS mode check**
- SHA-256/384/512 KATs pass (hardcoded NIST vectors at lines 81-100)
- CSPRNG check produces non-zero bytes
- `verifyFipsReadiness()` runs 4 checks (self-tests, SHA-256 availability, AES-256-GCM availability, CSPRNG)
- **Gap:** `isFipsCapable()` at line 174-186 only checks algorithm *availability*, not OpenSSL FIPS mode — will return `true` even when FIPS is not enforced

### 5. apps/server/src/middleware/sso-middleware.ts — OIDC Flow
**Result: ⚠️ Functional but limited**
- Proper OIDC authorization code flow with PKCE-like `state` + `nonce`
- JWKS fetch with caching (1-hour TTL)
- Claim validation: `iss`, `aud` (array support), `exp`, `nonce`
- **CRITICAL GAP:** Only RSA keys supported (line 241-243). EC key providers (Apple, Microsoft, Okta) will break
- Custom DER/ASN.1 encoding (lines 269-334) — hand-rolled, no well-known library
- `keys[0]` fallback when no `kid` (line 168) — weakens key pinning
- Session tokens use existing `SessionToken` (HMAC-SHA256) — consistent with rest of system

### 6. apps/server/src/middleware/audit-log.ts — HTTP Audit Trail
**Result: ❌ Plain ring buffer, no tamper evidence**
- In-memory ring buffer, max 1000 entries (line 23)
- No hash chaining, no disk persistence, no hash verification
- `readAuditLog()` at line 55-57 returns `[]` — **completely broken**
- **This is entirely separate from the compliance AuditTrail class** — two parallel audit systems

### 7. packages/permissions/ — Permission Engine
**Result: ✅ Stateless, deterministic, well-designed**
- Evaluation order: CommandRule → AgentRule → PathRule → ToolRule → Fallback `ask`
- `evaluate()` takes the same input + policy → same output (proven by snapshotted tests)
- Path matching supports: exact basename, extension glob, env variants, directory prefix
- Command rules cover: `rm -rf`, `sudo rm`, `chmod -R`, `dd`, `git reset --hard`, pipe-to-shell (`| sh`, `curl|sh`, etc.)
- Agent rules differentiate build (normal) vs plan (restricted) postures
- **Gaps:** Path rules are provisional (PERM-004), command rules provisional (PERM-005), gate has no timeout (PERM-EXPIRY)

### 8. .github/dependabot.yml — Workspace Coverage
**Result: ✅ Now covers all workspace packages** (since July 3 audit)
- Lists all package directories: `apps/*`, `packages/storage`, `protocol`, `sdk`, `tools`, `eval`, `auth`, `diff`, `plugin-sdk`, `collab`, `core`, `permissions`
- Also covers: `tests`, GitHub Actions, pip (root)
- Grouped by workspace to reduce noise

### 9. .github/CODEOWNERS — Path Coverage
**Result: ⚠️ Missing critical paths**
- Covers: `.github/*`, `.ai/*`, `bin/*`, `scripts/*`, `config/*`, `packages/auth/*`, `packages/permissions/*`, `packages/storage/*`, `*.env.example`
- **Missing:** `packages/compliance/*`, `apps/server/src/middleware/*`, `plugins/*`, `apps/tui/*`, `apps/cli/*`, docs/

### 10. .github/workflows/ai-safety.yml — Secret Scanning
**Result: ⚠️ Basic but incomplete**
- Greps for 5 patterns (OpenAI key, Anthropic key, GitHub token, Telegram token, private keys)
- Excludes `.md` files — but documentation often shows API key examples
- **Missing:** AWS keys, GCP keys, Azure keys, npm tokens, Slack tokens, Discord tokens, GitHub fine-grained PATs (`github_pat_*`)
- **Missing:** Pre-commit git hook scanning
- **No binary scanning for images with embedded secrets**

### 11. .github/workflows/ci.yml — Compiler Flags & Security
**Result: ✅ Standard CI, ⚠️ No dedicated security step**
- TypeScript strict mode enabled (via tsconfig)
- Biome lint with `--skip-parse-errors`
- Tests with coverage
- **Gap:** No SAST/DAST step (no CodeQL, Semgrep, SonarCloud), no dependency vulnerability check in CI (only Dependabot weekly)

### 12. SECURITY.md — Disclosure Policy
**Result: ✅ Reasonable but ⚠️ narrow scope**
- Reports via email to maintainer (48h response)
- 90-day disclosure timeline
- Supported versions: `main` only (pre-v1.0 — acceptable)
- **Out of scope includes CI config and planning docs** — slightly concerning for a security whitepaper

### 13. .env.example — Accidental Secrets
**Result: ⚠️ Clean but contains commented examples that can trigger scanners**
- All values are marked `sk-...` (placeholder format)
- No actual credentials
- However, simple `grep` secret scanners will match these commented patterns

### 14. AGENT_WORKBENCH_AIRGAPPED Enforcement
**Result: ❌ NOT enforced in server/core**
- Only functional in `createAirGappedFetch()` — a manual wrapper
- `apps/server/src/config.ts` (lines 39-49) does not check the env var
- `packages/core` has **zero references** to the airgap module
- Setting the env var has **no effect** unless the calling code explicitly uses the wrapped fetch
- The documentation claims it blocks all external calls — this is **false** for the default setup

### 15. SBOM Script — scripts/sbom.sh
**Result: ⚠️ Generates CycloneDX v1.5 but fragile**
- `uuidgen` fallback via `md5sum` (line 168) — deterministic
- Shell-based `bun pm ls --all` parsing is unreliable for scoped packages (line 84-103)
- Missing sub-dependency information (only direct dependencies listed in the dependsOn array)
- No PURL validation, no hashes for components

### 16. Data Retention — Cron/Schedule
**Result: ❌ Policy exists but nothing calls it**
- `applyRetention()` at data-retention.ts:25 is fully implemented
- `mergeEntries()` deduplicates and sorts by timestamp
- **No cron job, no setInterval, no server startup task calls `applyRetention()`**
- Audit trails grow unbounded

### 17. Secrets in Git History
**Result: ✅ No real secrets found**
- `sk-...` appears in test files (`opencode-config.test.ts`, `pii-scanner.test.ts`) — these are test fixtures, not real keys
- `ghp_` and `AKIA` patterns are found in git history but only as test strings or documentation examples
- **One concern:** Test file `opencode-config.test.ts` line 93 uses `"sk-test-key"` as a test fixture — while clearly fake, it creates a pattern that could appear in a scanner report

### 18. Hardcoded Secrets in Source Files
**Result: ✅ None found in production code**
- AuthManager's fallback secret at line 160 is clearly labeled as placeholder
- OpenCode bridge test file has `"sk-test-key"` (test scope only, not committed to production bundle)
- API keys come from environment variables or user config files

### 19. biome.json — Disabled Security Rules
**Result: ❌ Security-critical rule disabled**
- `noDangerouslySetInnerHtml: "off"` — and active `innerHTML` usage found in 2 production TSX files
- `noGlobalEval: "error"` — good
- All 8 a11y rules disabled — acceptable for a developer tool but eliminates accessibility safety net
- Missing security rules: `useTrustedTypes`, `noDocumentCookie`, `noDocumentWrite`

### 20. OpenCode Bridge Security
**Result: ⚠️ Reads untrusted config files from user home**
- Reads `~/.config/opencode/opencode.jsonc` and `~/.local/share/opencode/auth.json`
- These are user-owned files — not untrusted from a security perspective
- API keys are held in memory for plugin lifetime with no zeroization
- The config parser strips JSONC comments but does **no validation** on the provider name — if a provider name contains injection characters, it could theoretically affect the `KNOWN_BASE_URLS` lookup (though it's a dictionary key, so limited impact)
- **The primary risk is credential exfiltration**: if the server is compromised, the in-memory API keys can be read via memory inspection or debug endpoints

---

## Prioritized Action Plan

### Immediate (Next Sprint)
1. **H-01/H-06:** Merge the two audit systems — replace the HTTP middleware's ring buffer with the compliance `AuditTrail` (with hash chaining). Add disk persistence (append-only log file or SQLite). Fix `readAuditLog()` to return actual entries.
2. **H-02:** Either re-enable `noDangerouslySetInnerHtml: "error"` in biome.json and use a safe rendering approach (DOMPurify, or a React-compatible markdown renderer), OR explicitly document why XSS is acceptable in a local-first dev tool with appropriate warnings.
3. **M-01:** Run `bun update` to resolve the 3 dependency advisories. If esbuild is pinned by Vite, add an override.
4. **H-04:** Wire `applyRetention()` into the server startup lifecycle (run on a setInterval or cron schedule).
5. **H-05:** Have the server's config/bootstrap check `AGENT_WORKBENCH_AIRGAPPED` and inject `createAirGappedFetch()` as the default fetch implementation for all provider calls.

### Short Term (2-3 Sprints)
6. **H-03:** Add EC key (ECDSA P-256/P-384) support to the SSO middleware's `jwkToSpki`. Consider using a well-tested JWT verification library (`jose` or `jsonwebtoken`) instead of hand-rolled DER encoding.
7. **M-02:** Add CODEOWNERS entries for `packages/compliance/*`, `apps/server/src/middleware/*`, `plugins/*`, `apps/tui/*`, `apps/cli/*`.
8. **M-06:** Expand ai-safety.yml patterns to cover AWS keys, GCP keys, npm tokens, `ghp_`/`gho_`/`ghs_`/`ghu_` tokens, and generic `BEGIN EC/DSA/OPENSSH PRIVATE KEY`.
9. **M-08:** Add OpenSSL FIPS mode detection via `/proc/sys/crypto/fips_enabled` or `crypto.getFips()` in Node.js/Bun.
10. **L-06:** Add a pre-commit hook using `gitleaks` or `trufflehog` to scan staged changes for secrets.

### Medium Term
11. **M-05:** Add a local IP exemption list or raise the confidence threshold for IPv4 detection.
12. **M-07:** Rewrite SBOM script as a Node.js or TypeScript CLI for deterministic dependency resolution.
13. **L-01:** Implement PERM-EXPIRY — add a timeout to `PermissionGate.waitForDecision()`, defaulting to 5 minutes.
14. **L-05:** Sort by `timestamp` then `id` in `mergeEntries()` to prevent timestamp collisions from breaking the chain.
15. **M-10:** Simplify `.env` path rules — remove the confusing `*.env` pattern.
16. **L-03:** Update SECURITY.md to include CI config in-scope for security reviews.

---

*Report generated by Hermes Agent. Findings based on source inspection, dependency analysis, and architecture review conducted July 7, 2026.*
