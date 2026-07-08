# `@agent-workbench/compliance`

Enterprise compliance features: immutable audit trail, PII scanning, FIPS 140-2
helpers, data retention policies, and air-gapped mode enforcement.

This package is fully implemented and tested (178 tests across 10 files).

## Exports

| Module | Export | Description |
|--------|--------|-------------|
| `audit` | `AuditTrail` | SHA-256 chain-hashed immutable audit trail with `append`, `verify`, `query` |
| `audit` | `computeHash` | Compute SHA-256 hash for an audit entry |
| `pii-scanner` | `PiiScanner` | PII detection with 10 built-in patterns (email, phone, SSN, credit card, IP, API keys, etc.) |
| `pii-scanner` | `defaultPiiScanner` | Pre-configured scanner instance |
| `pii-scanner` | `RedactMode` | `redact` / `mask` / `hash` modes |
| `fips` | `verifyFipsReadiness` | FIPS 140-2 self-tests (KATs, CSPRNG, algorithm availability) |
| `fips` | `runSelfTests` | Known Answer Tests for SHA-256/384/512 |
| `fips` | `isFipsApproved` | Check if an algorithm is FIPS-approved |
| `fips` | `secureRandomBytes/Hex/String` | CSPRNG wrappers |
| `data-retention` | `applyRetention` | Apply retention policy to audit entries |
| `data-retention` | `mergeEntries` | Merge + deduplicate audit entry arrays |
| `airgap` | `isAirGapped` | Check `AGENT_WORKBENCH_AIRGAPPED` env var |
| `airgap` | `createAirGappedFetch` | Create fetch wrapper blocking external URLs |

## Related Docs

- [`docs/compliance/`](../../docs/compliance/) — SOC 2, GDPR, deployment guides
- [`docs/05_PERMISSION_MODEL.md`](../../docs/05_PERMISSION_MODEL.md) — RBAC definitions
- [`docs/06_SECURITY_MODEL.md`](../../docs/06_SECURITY_MODEL.md) — Threat model
