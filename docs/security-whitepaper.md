# agent-workbench Security Whitepaper

> **Phase 30 — Enterprise Readiness & Compliance**
> Version 1.0 — July 3, 2026

## Executive Summary

agent-workbench is a local-first agent workbench designed for disciplined software development. It processes source code, interacts with LLM providers, and manages session data. This whitepaper describes the security architecture, controls, and compliance posture.

## Architecture

### Deployment Model

- **Local-first**: All data is stored locally in a SQLite database
- **Plug-in architecture**: Model providers are loaded as plugins
- **Local HTTP/SSE server**: Control plane runs on localhost
- **Optional remote access**: TLS-authenticated remote access via bearer tokens

### Data Flow

```
User → TUI/Mobile Web → Local Server → Plugin Providers → LLM APIs
                         ↓
                   SQLite (local storage)
                         ↓
                   Audit Trail (immutable log)
```

## Authentication & Authorization

### Bearer Token Authentication

- HMAC-signed session tokens
- Configurable TTL (default: 1 hour)
- Token scopes for granular access control
- Env-gated: `AGENT_WORKBENCH_AUTH_ENABLED`

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Viewer** | Read-only: sessions, files (grep/glob), metrics |
| **Developer** | Viewer + write/edit files, run shell commands, eval tools |
| **Admin** | Developer + manage auth, manage plugins, configure server |

### Single Sign-On

- OIDC support (Okta, Auth0, Azure AD)
- SAML 2.0 support
- Configurable role mapping from SSO claims

## Data Protection

### Encryption

- **In transit**: TLS 1.2+ for all API communications
- **At rest**: SQLite database (OS-level encryption supported)
- **Credentials**: API keys never stored — read from environment variables
- **Audit trail**: SHA-256 hash chaining for tamper detection

### PII Detection

agent-workbench includes a built-in PII scanner that detects:

| Category | Severity | Examples |
|----------|----------|---------|
| API Keys | CRITICAL | `sk-*`, `ghp_*`, `xox[baprs]-*` |
| Auth Tokens | CRITICAL | Bearer tokens, JWTs |
| SSN | HIGH | `123-45-6789` |
| Credit Cards | HIGH | 16-digit numbers |
| Crypto Wallets | HIGH | Ethereum/bitcoin addresses |
| Email | MEDIUM | `user@example.com` |
| Phone | MEDIUM | US phone numbers |
| IP Address | MEDIUM | IPv4 addresses |

### Data Retention

- Configurable retention window (default: 90 days)
- Automatic cleanup of expired sessions, messages, and tool calls
- Optional audit trail purge
- Configurable via environment variables

## Audit & Compliance

### Immutable Audit Trail

- Append-only log with SHA-256 hash chaining
- Each entry includes the previous entry's hash (blockchain-style)
- `verifyIntegrity()` detects any tampering or modification
- Supports queries by action, actor, resource, and time range

### Compliance Headers

| Header | Value |
|--------|-------|
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Restricted camera/mic/geolocation |
| Cross-Origin-Embedder-Policy | `require-corp` |
| Strict-Transport-Security | Configurable max-age |
| Content-Security-Policy | Configurable (default: self-only) |

## Network Security

### Air-Gapped Mode

When enabled (`AGENT_WORKBENCH_AIRGAP_ENABLED=true`):
- All external HTTP/HTTPS requests are blocked
- Only localhost connections on allowed ports are permitted
- Only bundled/local models (Ollama, llama.cpp) are available
- Configurable via `AGENT_WORKBENCH_AIRGAP_ALLOWED_PORTS`

### Rate Limiting

- Configurable rate limits on API endpoints
- Token bucket algorithm
- Prevents abuse of provider API calls

## Supply Chain Security

### Dependency Management

- Bun lockfile (`bun.lock`) provides deterministic installs
- Dependabot configured for weekly dependency updates
- SBOM generation via CycloneDX format available in CI
- All dependencies are open-source with known provenance

### Release Process

- Signed git tags for releases
- CI pipeline runs typecheck, lint, and full test suite
- CodeQL security scanning on every PR
- AI safety checks prevent secret leakage

## Compliance Frameworks

- **SOC 2 Type II**: Readiness checklist available in `docs/soc2-readiness-checklist.md`
- **GDPR**: Data processing addendum available in `docs/gdpr-data-processing-addendum.md`
- **FIPS 140-2**: Compliance checker available in `packages/compliance/src/fips.ts`
