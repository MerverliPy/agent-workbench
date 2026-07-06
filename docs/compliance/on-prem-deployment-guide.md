# On-Premises Deployment Guide — agent-workbench

**Document version:** 1.0  
**Date:** 2026-07-06  

---

## 1. Overview

agent-workbench is designed for local-first, single-user operation. This guide covers deploying it on-premises for individual developers or as a shared service within a trusted network.

---

## 2. Prerequisites

### 2.1 System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 8 GB |
| Disk | 500 MB | 5 GB (for session data) |
| OS | Linux, macOS, Windows (WSL2) | Linux |

### 2.2 Runtime

- **Bun** >= 1.x ([install guide](https://bun.sh/docs/installation))
- **Git** (optional, for version control features)

### 2.3 Optional Dependencies

- **Ollama** for local LLM inference (air-gapped mode)
- **SQLite** (bundled with Bun)
- **Tailscale** for remote access

---

## 3. Installation

### 3.1 From Source

```bash
git clone https://github.com/MerverliPy/agent-workbench.git
cd agent-workbench
bun install
bun run build
```

### 3.2 From Release

```bash
# Download the latest release tarball
curl -L https://github.com/MerverliPy/agent-workbench/releases/latest/download/agent-workbench.tar.gz \
  -o agent-workbench.tar.gz
tar -xzf agent-workbench.tar.gz
cd agent-workbench
bun install --production
```

---

## 4. Configuration

### 4.1 Environment Variables

#### Required (at least one)

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_WORKBENCH_PROVIDER` | Default model provider (`openai`, `anthropic`, `openrouter`, `ollama`) | (stub) |

#### Network

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKBENCH_HOST` | Bind address | `127.0.0.1` |
| `WORKBENCH_PORT` | Server port | `3000` |
| `AGENT_WORKBENCH_CORS_ORIGINS` | Additional CORS origin patterns | (loopback only) |

#### Security

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_WORKBENCH_AIRGAPPED` | Enable air-gapped mode (`true`/`false`) | `false` |
| `AGENT_WORKBENCH_AUTH_ENABLED` | Enable bearer token auth | `false` |
| `AGENT_WORKBENCH_AUTH_SECRET` | Shared secret for token generation | (none) |
| `AGENT_WORKBENCH_TLS_ENABLED` | Enable HTTPS | `false` |
| `AGENT_WORKBENCH_SSO_ISSUER` | OIDC issuer URL | (none) |
| `AGENT_WORKBENCH_SSO_CLIENT_ID` | OIDC client ID | (none) |
| `AGENT_WORKBENCH_SSO_CLIENT_SECRET` | OIDC client secret | (none) |
| `AGENT_WORKBENCH_SSO_REDIRECT_URI` | OIDC callback URI | (none) |

#### Provider API Keys

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

### 4.2 Configuration File

Create `~/.agent-workbench/config.json`:

```json
{
  "host": "127.0.0.1",
  "port": 3000,
  "provider": "ollama",
  "model": "llama3.2",
  "airGapped": true
}
```

Environment variables take precedence over config file values.

---

## 5. Deployment Scenarios

### 5.1 Single Developer (Default)

```bash
# Clone and start
cd agent-workbench
bun run apps/server/src/index.ts
# → Server listens on http://127.0.0.1:3000
# → Open the TUI or mobile web companion
```

### 5.2 Air-Gapped Deployment

```bash
export AGENT_WORKBENCH_AIRGAPPED=true
export AGENT_WORKBENCH_PROVIDER=ollama
# Ensure Ollama is running
ollama serve &
# Start agent-workbench
bun run apps/server/src/index.ts
```

**What air-gapped mode blocks:**
- All external HTTP/HTTPS calls
- Provider API endpoints (OpenAI, Anthropic, OpenRouter)
- Any URL not targeting localhost or loopback

**What continues to work:**
- Local Ollama inference
- Stub provider
- All local file operations
- All tool execution
- Audit trail, PII scanner, RBAC

### 5.3 TLS-Encrypted Deployment

```bash
export AGENT_WORKBENCH_TLS_ENABLED=true
export AGENT_WORKBENCH_AUTH_ENABLED=true
export AGENT_WORKBENCH_AUTH_SECRET=your-shared-secret
bun run apps/server/src/index.ts
```

### 5.4 SSO-Protected Deployment

```bash
export AGENT_WORKBENCH_AUTH_ENABLED=true
export AGENT_WORKBENCH_AUTH_SECRET=your-shared-secret
export AGENT_WORKBENCH_SSO_ISSUER=https://your-idp.example.com
export AGENT_WORKBENCH_SSO_CLIENT_ID=your-client-id
export AGENT_WORKBENCH_SSO_CLIENT_SECRET=your-client-secret
export AGENT_WORKBENCH_SSO_REDIRECT_URI=http://localhost:3000/auth/sso/callback
bun run apps/server/src/index.ts
```

### 5.5 Shared Service (Trusted Network)

For shared access within a trusted network:

```bash
export WORKBENCH_HOST=0.0.0.0
export AGENT_WORKBENCH_AUTH_ENABLED=true
export AGENT_WORKBENCH_AUTH_SECRET=your-shared-secret
export AGENT_WORKBENCH_TLS_ENABLED=true
bun run apps/server/src/index.ts
```

**⚠️ Security warnings:**
1. Only expose to trusted networks.
2. Always enable TLS when binding to non-loopback.
3. Always enable authentication.
4. Use SSO for team deployments.
5. Apply RBAC to restrict access per user role.

---

## 6. Hardening Checklist

- [ ] Server bound to loopback unless explicitly needed
- [ ] TLS enabled for any non-loopback access
- [ ] Bearer token auth enabled
- [ ] Strong `AGENT_WORKBENCH_AUTH_SECRET` (min 32 chars, random)
- [ ] SSO configured for team deployments
- [ ] RBAC roles assigned appropriately
- [ ] Air-gapped mode enabled when using local models only
- [ ] Data retention policy configured
- [ ] PII scanner configured with appropriate patterns
- [ ] CORS origins restricted
- [ ] Audit trail reviewed periodically
- [ ] SBOM generated and reviewed (`bun run sbom`)
- [ ] Dependencies audited (`bun pm audit`)
- [ ] Regular backup of SQLite database (session data)
- [ ] TLS certificate from trusted CA (not self-signed for prod)

---

## 7. Monitoring

### 7.1 Health Endpoint

```bash
curl http://localhost:3000/health
```

Returns server status, version, and uptime.

### 7.2 Metrics

Metrics are exposed via the observability routes. Available metrics:

- Request count and latency
- Token usage per provider
- Error rate
- Permission gate activity
- Active sessions

### 7.3 Logging

Logs are written to stdout by default. Redirect to a file:

```bash
bun run apps/server/src/index.ts > /var/log/agent-workbench.log 2>&1
```

Or use a systemd journal:

```ini
[Service]
ExecStart=/usr/local/bin/bun /opt/agent-workbench/apps/server/src/index.ts
StandardOutput=journal
StandardError=journal
```

---

## 8. Backup and Recovery

### 8.1 Data Locations

| Data | Location | Format |
|------|----------|--------|
| Session data | `~/.agent-workbench/data/` | SQLite |
| Configuration | `~/.agent-workbench/config.json` | JSON |
| Audit trail | In-memory (in the compliance module) | JSON |
| Prompt library | `~/.agent-workbench/prompts/` | Markdown |

### 8.2 Backup Procedure

```bash
# Backup session database
cp ~/.agent-workbench/data/agent-workbench.db ~/backups/awb-$(date +%Y%m%d).db

# Export all sessions
curl http://localhost:3000/api/sessions/export > ~/backups/sessions-$(date +%Y%m%d).json
```

### 8.3 Restore

```bash
# Restore database
cp ~/backups/awb-20260101.db ~/.agent-workbench/data/agent-workbench.db

# Reimport sessions
curl -X POST http://localhost:3000/api/sessions/import \
  -H "Content-Type: application/json" \
  -d @~/backups/sessions-20260101.json
```

---

## 9. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Server won't start | Port in use | Set `WORKBENCH_PORT` to a different value |
| No provider available | AGENT_WORKBENCH_PROVIDER not set | Set provider or use stub |
| "Air-gapped mode" error | External provider in air-gapped mode | Switch to Ollama or disable air-gapped |
| Auth errors | Wrong or missing secret | Verify `AGENT_WORKBENCH_AUTH_SECRET` |
| SSO not working | OIDC misconfiguration | Check issuer URL, client ID/secret, redirect URI |
| PII scanning too aggressive | Pattern config too broad | Adjust `minConfidence` or disable patterns |

---

## 10. Upgrades

```bash
cd agent-workbench
git fetch origin
git pull --ff-only
bun install
bun run build
# Restart the server
```

Always check `CHANGELOG.md` for breaking changes before upgrading.

---

*For additional support, open an issue in the [agent-workbench repository](https://github.com/MerverliPy/agent-workbench).*
