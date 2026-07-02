# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in agent-workbench, please report it privately **before** disclosing it publicly.

**Do not** open a public GitHub issue for security vulnerabilities.

### How to Report

Send an email to **calvinbrady8@gmail.com** with the following details:

- A brief description of the vulnerability
- Steps to reproduce it
- Any relevant code, configuration, or logs
- Your suggested fix (if applicable)

You should receive a response within **48 hours**. If you don't, please follow up.

### What to Expect

- Confirmation of receipt within 48 hours
- An assessment of the severity and impact
- A timeline for a fix and disclosure
- Credit in the release notes (if you would like it)

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| main    | ✅ Active development |

## Scope

The following are in scope for security reviews:

- The local server (`apps/server`) — binding, authentication, CORS
- The permission engine (`packages/permissions`) — policy bypasses
- The shell runner (`packages/shell`) — command injection, timeouts
- The storage layer (`packages/storage`) — SQL injection, data leakage
- Secret redaction in command output

## Out of Scope

- The TUI (`apps/tui`) — it is a thin client with no privileged operations
- GitHub Actions CI configuration
- Documentation and planning docs

## Responsible Disclosure

We aim to follow a **90-day disclosure timeline**: a fix will be released within 90 days of a report, at which point the vulnerability may be publicly disclosed.
