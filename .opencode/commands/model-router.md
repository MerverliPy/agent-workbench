---
description: Route a task through model-router v3.3 before implementation
agent: plan
model: deepseek/deepseek-v4-pro
---

Use the model-router v3.3 policy from:

/home/calvin/agent-workbench/tools/model-router-v3.3-repo-ready/prompts/model-router.md

You are routing this task only.

Hard constraints:
- Do not edit files.
- Do not run shell commands.
- Do not implement the task.
- Do not claim to have inspected files unless the user provided them or explicitly asked for repo inspection.
- Return the complete required model-router v3.3 output skeleton.
- If implementation is recommended, include the exact live OpenCode model choice when possible.
- Avoid Copilot as a primary autonomous repo-work route.
- Require approval for destructive, auth, secrets, CI/CD, database, production, or broad multi-file changes.

Task to route:

$ARGUMENTS
