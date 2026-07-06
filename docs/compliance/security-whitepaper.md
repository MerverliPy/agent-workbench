# Security Whitepaper — agent-workbench

**Document version:** 1.0  
**Date:** 2026-07-06  
**Classification:** Public  

---

## 1. Overview

agent-workbench is a local-first, open-source agentic coding workbench. It runs as a local HTTP/SSE server on the developer's machine, providing a Terminal User Interface (TUI), mobile web companion, and CLI interface for AI-assisted software development.

This whitepaper describes the security architecture, threat model, and compliance posture of agent-workbench for enterprise deployment evaluation.

---

## 2. Architecture Principles

| Principle | Description |
|-----------|-------------|
| **Local-first** | All core services run on the developer's machine. No mandatory external dependencies. |
| **Least privilege** | Tools and permissions follow the minimum-access model documented in AGENTS.md. |
| **Defense in depth** | Authentication, authorization, audit logging, and network isolation are layered. |
| **Transparency** | Open-source codebase (MIT license). All cryptographic operations use standard libraries. |

---

## 3. Network Security

### 3.1 Default Surface

- Server binds to `127.0.0.1` (loopback only) by default.
- No ports are exposed to the network unless explicitly configured.

### 3.2 TLS

- Auto-generated self-signed TLS certificates for HTTPS.
- Configurable via environment variables:
  - `AGENT_WORKBENCH_TLS_ENABLED=true`
  - `AGENT_WORKBENCH_TLS_CERT`, `AGENT_WORKBENCH_TLS_KEY` for custom certificates.

### 3.3 Air-Gapped Mode

- Set `AGENT_WORKBENCH_AIRGAPPED=true` to block all external network calls.
- Only loopback addresses (localhost, 127.0.0.1, ::1) are permitted.
- Local Ollama inference continues to work; external provider APIs (OpenAI, Anthropic, etc.) are blocked.
- Provider adapters receive a wrapped `fetch` implementation that throws `AirGapBlockedError` on any external URL.
- Falls back to the built-in stub provider when no local provider is available.

### 3.4 CORS

- Default CORS policy allows only loopback origins (`localhost`, `127.0.0.1`, `[::1]`).
- Configurable via `AGENT_WORKBENCH_CORS_ORIGINS` regex patterns.

---

## 4. Authentication & Authorization

### 4.1 Bearer Token Auth

- Optional bearer token authentication via `AGENT_WORKBENCH_AUTH_ENABLED=true`.
- Token generation requires a pre-shared secret (`AGENT_WORKBENCH_AUTH_SECRET`).
- Time-limited session tokens with configurable TTL (default: 1 hour).

### 4.2 SSO (OIDC)

- Built-in OIDC SSO middleware supporting Okta, Auth0, Azure AD, and any OIDC-compliant IdP.
- No external OAuth libraries — JWKS verification uses Node.js built-in `crypto` module.
- Routes: `/auth/sso/login`, `/auth/sso/callback`.
- Issues `awb_v1_` prefixed session tokens on successful authentication.

### 4.3 RBAC

Three hierarchical roles:

| Role     | Scope                                                        |
|----------|--------------------------------------------------------------|
| Viewer   | Read-only access to sessions, files, and workspace state     |
| Developer| Read + write, tool execution, session management             |
| Admin    | Full access including user management, provider config, SSO  |

All roles enforce scope-based access via Hono middleware, returning 401 (unauthenticated) or 403 (insufficient role).

---

## 5. Audit Trail

### 5.1 Immutable Chain

All security-relevant actions are recorded in an append-only audit trail:

- SHA-256 cryptographic chaining between entries.
- Genesis entry verification ensures chain integrity.
- Tamper detection: any modification to an entry breaks its hash and the entire subsequent chain.
- Queryable by actor, action, and time range.

### 5.2 Audited Events

- Session creation, deletion, and access.
- Permission grants and denials.
- Authentication and authorization decisions.
- Configuration changes.
- Tool execution approvals.

---

## 6. Data Protection

### 6.1 Data Retention

- Configurable retention policies with `maxAgeDays` and `exemptActions`.
- Auto-deletion of session data older than the configured threshold.
- Batch deduplication via `mergeEntries()`.

### 6.2 PII Detection

The `PiiScanner` module detects and redacts:

| Pattern        | Example                          |
|----------------|----------------------------------|
| Email          | `user@example.com`               |
| Phone          | `+1-555-123-4567`                |
| SSN            | `123-45-6789`                    |
| Credit card    | `4111-1111-1111-1111`            |
| IP address     | `192.168.1.1`, `::1`             |
| API key        | `sk-...`, `api-...`              |
| Bearer token   | `Bearer eyJ...`                  |
| URL credential  | `https://user:pass@host`         |
| Date of birth  | `1990-01-01`                     |

Three redaction modes: `mask` (partial reveal), `redact` (full replacement), `hash` (SHA-256 prefix).

---

## 7. Cryptographic Standards

### 7.1 FIPS 140-2 Compliance

- Algorithm approval checks for all cryptographic operations.
- Known Answer Tests (KAT) for SHA-256, SHA-384, SHA-512.
- CSPRNG via Node.js `crypto.randomBytes()`.
- FIPS readiness verification (`verifyFipsReadiness()`) with detailed summary.

### 7.2 Approved Algorithms

| Algorithm      | FIPS Approved |
|----------------|:------------:|
| SHA-256        | ✅           |
| SHA-384        | ✅           |
| SHA-512        | ✅           |
| AES-128-GCM    | ✅           |
| AES-256-GCM    | ✅           |
| HMAC-SHA-256   | ✅           |
| RSA-2048+      | ✅           |
| ECDSA-P256     | ✅           |
| ECDSA-P384     | ✅           |

---

## 8. Supply Chain Security

- SBOM generation via `bun run sbom` (CycloneDX format).
- Dependency vulnerability scanning integrated into CI pipeline.
- All dependencies are pinned via `bun.lock` lockfile.
- Regular dependency audits: `bun pm audit` before releases.

---

## 9. Permission Model

### 9.1 Default Policy

| Operation    | Default |
|-------------|:------:|
| File read    | Allow  |
| File grep/glob | Allow |
| File write   | Ask    |
| Shell execution | Ask |
| Destructive operations | Deny |

### 9.2 Permission Scope

- Session-scoped permission gates.
- Temporary approval with configurable TTL.
- Persistent grant/deny decisions stored in the permission repository.
- All decisions logged to the audit trail.

---

## 10. Threat Model

| Threat | Mitigation |
|--------|-----------|
| Unauthorized local access | Optional bearer token auth + RBAC |
| Remote exploitation | Loopback-only default, TLS, air-gapped mode |
| Data exfiltration via model providers | PII scanner, audit trail |
| Supply chain attack | Lockfile, SBOM, `bun pm audit` |
| Privilege escalation | RBAC with scope enforcement |
| Tampered audit records | SHA-256 cryptographic chaining |

---

## 11. Compliance Mapping

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| SOC 2 (Security) | Ready | See `SOC-2-Readiness-Checklist.md` |
| SOC 2 (Availability) | Partial | Health monitoring, metrics |
| SOC 2 (Confidentiality) | Ready | PII scanner, RBAC, audit trail |
| SOC 2 (Privacy) | Ready | Data retention, GDPR addendum |
| GDPR | Ready | See `GDPR-Addendum.md` |
| Air-gapped operation | Supported | `AGENT_WORKBENCH_AIRGAPPED=true` |
| FIPS 140-2 | Partial | Algorithm helpers, self-tests |

---

*This document is maintained as part of the agent-workbench project. For the latest version, see `docs/compliance/` in the repository.*
