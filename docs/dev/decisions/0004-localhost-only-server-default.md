# 0004 — Localhost-Only Server Default

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The backend will eventually coordinate file reads, file mutations, shell commands, provider access, permissions, and session storage. Exposing it broadly by default would create unacceptable risk.

## Decision

The server must bind to localhost by default, preferably `127.0.0.1`.

## Rationale

The project is local-first. Localhost-only binding reduces accidental exposure of a privileged local control plane.

## Consequences

### Positive

```text
[+] Safer default.
[+] Aligns with local-first design.
[+] Reduces remote attack surface.
[+] Makes early auth design simpler.
```

### Negative / Tradeoffs

```text
[-] Remote/LAN workflows are not available by default.
[-] Browser or remote-client support may require later auth/CORS review.
```

## Implementation Rules

```text
[ ] Server binds to localhost by default.
[ ] Do not bind to 0.0.0.0 by default.
[ ] CORS must be restrictive by default.
[ ] Logs should show bind address.
[ ] Remote/LAN access requires explicit future confirmation.
```

## Boundaries

Localhost-only does not replace permission checks. Even local clients must go through server validation and backend policy.

## Risks

```text
[ ] Developer may expose server accidentally for convenience.
[ ] Auth mechanism remains unresolved.
[ ] Future web/remote access requires security design.
```

## Validation Checklist

```text
[ ] Default bind address is localhost.
[ ] Remote access is not enabled by default.
[ ] Security docs preserve this decision.
```

## Notes for Future Agents

Do not introduce remote server mode unless the user explicitly requests it.
