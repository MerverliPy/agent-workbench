# GDPR Data Processing Addendum

> **Phase 30 — Enterprise Readiness & Compliance**
> Last updated: July 3, 2026

## 1. Data Controller and Processor

- **Controller**: The organization deploying agent-workbench
- **Processor**: agent-workbench (the software application)
- **Sub-processors**: LLM model providers configured by the user (OpenAI, Anthropic, DeepSeek, etc.)

## 2. Data Processing Details

### Categories of Data Subjects

- Developers using agent-workbench for software development
- End users interacting with agents created via agent-workbench

### Types of Personal Data Processed

| Data Type | Example | Processing Purpose | Retention |
|-----------|---------|-------------------|-----------|
| Code content | Source code, file contents | Agent task execution | Configurable (default 90 days) |
| Prompts | User questions and instructions | Model inference | Configurable (default 90 days) |
| API keys | Provider credentials | Model access | Not stored — read from env vars |
| Logs/telemetry | Session events, tool calls | Auditing and debugging | Configurable (default 90 days) |
| Audit trail | Immutable action log | Compliance verification | Permanent (append-only) |

### Processing Purposes

- AI-assisted software development
- Code review and analysis
- Task automation
- Debugging and troubleshooting

## 3. Data Subject Rights

agent-workbench provides the following mechanisms for data subject rights:

| Right | Implementation | Status |
|-------|---------------|--------|
| Right to access | API endpoint to list personal data | ⏳ **Planned** |
| Right to rectification | Data is session/ephemeral; edit via workspace | ✅ **Supported** |
| Right to erasure | `DataRetention.cleanup()` deletes expired sessions | ✅ **Implemented** |
| Right to restrict processing | Air-gapped mode disables external processing | ✅ **Implemented** |
| Right to data portability | Session data export via API | ⏳ **Planned** |
| Right to object | Users can disable audit/logging features | ✅ **Implemented** |

## 4. Data Transfers

agent-workbench is a local-first application. Data transfers occur only when:

1. **Model provider API calls**: Prompts are sent to configured LLM providers
2. **Configuration**: The user chooses which providers to use
3. **Transfer mechanism**: Encrypted HTTPS connections

### Safeguards

- All API calls use TLS 1.2+ encryption
- API keys are read from environment variables, not stored
- Users can configure air-gapped mode to prevent all external transfers
- Standard Contractual Clauses (SCCs) apply when using EU-based providers

## 5. Security Measures

See [SOC 2 Readiness Checklist](./soc2-readiness-checklist.md) for the full security controls.

- ✅ RBAC with admin/developer/viewer roles
- ✅ Immutable audit trail with hash chaining
- ✅ PII scanning and redaction
- ✅ TLS encryption for all communications
- ✅ Rate limiting on API endpoints
- ✅ Security headers (CSP, HSTS, X-Frame-Options)

## 6. Data Breach Notification

In the event of a data breach:

1. The audit trail provides a complete record of all actions
2. Data retention policies limit the window of exposure
3. Organizations should configure their own alerting for suspicious activity
4. Notify relevant supervisory authorities within 72 hours as required by GDPR

## 7. Sub-processing

agent-workbench uses the following sub-processors:

| Sub-processor | Service | Data Transferred | Safeguards |
|--------------|---------|-----------------|------------|
| LLM providers (user-configured) | Model inference | Prompts, code content | TLS encryption, no storage of API keys |
| Local SQLite database | Session storage | All session data | Encrypted at rest (OS-level) |
