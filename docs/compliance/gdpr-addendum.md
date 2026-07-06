# GDPR Data Processing Addendum — agent-workbench

**Document version:** 1.0  
**Date:** 2026-07-06  
**Classification:** Public  

---

## 1. Parties

| Role | Entity |
|------|--------|
| **Data Controller** | The organization deploying agent-workbench (the "Customer") |
| **Data Processor** | The Customer's own infrastructure where agent-workbench is deployed |
| **Sub-Processors** | None by default. Model providers used (OpenAI, Anthropic, etc.) act as independent controllers for data sent to their APIs. |

---

## 2. Scope

This addendum applies to the processing of personal data by agent-workbench when used within the European Economic Area (EEA) or involving personal data of EEA data subjects.

---

## 3. Data Processing Details

### 3.1 Categories of Data Processed

| Category | Examples | Source |
|----------|----------|--------|
| User identifiers | Usernames, session tokens, device labels | User input, auth configuration |
| Session data | Conversation history, tool inputs/outputs | Agent interactions |
| Code and files | Source code, configuration files | File operations |
| Logs | Audit trail entries, error reports | System operations |

### 3.2 Special Categories (Article 9)

agent-workbench does not intentionally process special categories of personal data (health data, biometric data, political opinions, etc.). The PII scanner can optionally detect such patterns; users are responsible for ensuring appropriate safeguards.

### 3.3 Processing Purpose

Provide AI-assisted software development through a local-first agent workbench.

### 3.4 Processing Duration

Personal data is retained per configured retention policies (see `packages/compliance/src/data-retention.ts`). Default: no automatic deletion; configurable via `RetentionPolicy.maxAgeDays`.

---

## 4. Data Subject Rights

agent-workbench provides mechanisms to support all GDPR data subject rights:

| Right | Mechanism | Implementation |
|-------|-----------|----------------|
| **Right to Access** (Art. 15) | Data export endpoint | Session export (JSON + markdown), audit trail query |
| **Right to Rectification** (Art. 16) | Direct data editing | Data stored in local SQLite; direct SQL access available |
| **Right to Erasure** (Art. 17) | Data deletion | Retention policies, manual session deletion |
| **Right to Restrict Processing** (Art. 18) | Permission gate | Fine-grained permission model per operation |
| **Right to Data Portability** (Art. 20) | Data export | JSON exports, session reimport capability |
| **Right to Object** (Art. 21) | Opt-out | Air-gapped mode disables all external data transmission |
| **Automated Decision-Making** (Art. 22) | Human-in-the-loop | Permission gate requires human approval for write/exec operations |

---

## 5. Technical and Organizational Measures (TOMs)

### 5.1 Organizational Measures

| Measure | Description |
|---------|-------------|
| Data protection training | Relies on deploying organization's training |
| Access control policy | RBAC defined; three roles: viewer, developer, admin |
| Incident response | Error reporting and audit trail for detection |
| Regular testing | CI pipeline, security test suite |

### 5.2 Technical Measures

| Measure | Implementation |
|---------|----------------|
| Pseudonymization | PII scanner with `mask` mode |
| Encryption at rest | SQLite database; user-managed full-disk encryption |
| Encryption in transit | TLS (optional), loopback-only default |
| Access controls | RBAC middleware, scope-based authorization |
| Audit logging | Immutable SHA-256 chained audit trail |
| Data minimization | Local-only processing; no telemetry by default |
| Integrity verification | Audit trail tamper detection |
| Air-gapped mode | `AGENT_WORKBENCH_AIRGAPPED=true` blocks all external calls |

---

## 6. Data Transfers

### 6.1 Third Countries

When using external model providers (OpenAI, Anthropic, OpenRouter), data sent to their APIs may be transferred to servers outside the EEA. Users should:

1. Review the provider's GDPR compliance documentation.
2. Use air-gapped mode with a local model (Ollama) to avoid transfers entirely.
3. Execute a Data Processing Agreement (DPA) with the model provider.

### 6.2 Adequacy Decisions

| Provider | EU-US Data Privacy Framework | Standard Contractual Clauses |
|----------|:---------------------------:|:---------------------------:|
| OpenAI   | Certified                    | Available on request        |
| Anthropic | Certified                   | Available on request        |
| OpenRouter | Not certified              | Standard terms              |
| Ollama (local) | N/A (no transfer)     | N/A                         |

---

## 7. Incident Notification

The audit trail records all security-relevant events. In the event of a personal data breach:

1. The audit trail provides a chronological record of affected operations.
2. Data retention policies limit the scope of data at risk.
3. If in air-gapped mode, no data is transmitted externally — breach scope is limited to the local filesystem.

Notification to supervisory authorities and data subjects follows the deploying organization's incident response procedures.

---

## 8. Sub-Processing

| Sub-Processor | Purpose | Data Access |
|--------------|---------|-------------|
| None (default) | — | — |
| Model providers* | AI model inference | Messages sent to API endpoints |
| SQLite | Local data storage | No external access |

*\*Model providers act as independent controllers. Users control which providers are configured.*

---

## 9. Contact

For GDPR-related inquiries, open an issue in the [agent-workbench GitHub repository](https://github.com/MerverliPy/agent-workbench) or contact the project maintainers.

---

*This addendum is provided as a template. Organizations deploying agent-workbench should review and adapt it to their specific data processing context.*
