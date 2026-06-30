---
description: Implement only after accepting a model-router route
agent: build
model: deepseek/deepseek-v4-flash
---

Follow the approved model-router v3.3 route.

Implementation constraints:
- Plan first.
- Edit only files required by the approved route.
- Ask before edits if scope is unclear.
- Ask before destructive commands.
- Ask before dependency changes.
- Ask before lockfile changes.
- Ask before CI/CD, auth, secrets, database, permissions, deployment, or production-facing changes.
- Do not use Copilot as the primary autonomous executor.
- Preserve existing behavior unless the approved task requires a change.
- Show changed files and a concise diff summary before finalizing.

Task:

$ARGUMENTS
