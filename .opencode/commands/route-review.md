---
description: Review completed changes after routed implementation
agent: plan
model: deepseek/deepseek-v4-pro
---

Review only. Do not edit files.

Use the model-router v3.3 safety expectations from:

/home/calvin/agent-workbench/tools/model-router-v3.3-repo-ready/prompts/model-router.md

Check:
1. Correctness
2. Regression risk
3. Security risk
4. Missing tests
5. Scope creep
6. Mismatch against the approved router route
7. Whether the selected model/workflow was appropriate
8. Whether approval gates were respected

Required output:
- Verdict: pass / pass with concerns / fail
- Issues found
- Required fixes
- Suggested tests
- Final recommendation

Task or diff to review:

$ARGUMENTS
