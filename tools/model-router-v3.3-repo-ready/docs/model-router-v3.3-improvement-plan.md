# Model Router v3.3 Improvement Plan

**Status:** Plan only — do not treat this as a router patch yet.  
**Target next router file:** `model-router-fixed-v3.3.md`  
**Current router baseline:** `model-router-fixed-v3.2.md`  
**Current benchmark:** `model-router-bench-tests-v3.2.jsonl`  
**Current grader:** `model_router_grader_v3_2.py`  
**Current benchmark status:** Setup validated, real scoring still pending.  
**Created:** 2026-06-27

---

## 1. Goal

Create a controlled v3.3 patch plan that improves `model-router-fixed-v3.2.md` against likely real-benchmark failure points before expanding the router further.

v3.3 should focus on **routing reliability**, **grader compliance**, and **safety escalation**, not on adding more providers for its own sake.

---

## 2. Source-of-Truth Files

| File | Role in v3.3 planning |
|---|---|
| `CHATGPT_SESSION_HANDOFF(1).md` | Session continuity, original router purpose, completed artifacts, user constraints. |
| `model-router-fixed-v3.2.md` | Current router baseline. |
| `model-router-bench-tests-v3.2.jsonl` | 40-case benchmark suite. |
| `model_router_grader_v3_2.py` | Current scoring logic and hard-fail checks. |
| `model-router-real-responses-v3.2.jsonl` | Real response collection file; currently blank/unfinished. |
| `collect_model_router_benchmark_v3_2.py` | Manual response collection helper. |
| `model-router-real-benchmark-workflow-v3.2.md` | Formal benchmark workflow. |

---

## 3. v3.3 Success Criteria

v3.3 should be considered successful only if the real benchmark satisfies all of the following:

| Metric | Target |
|---|---:|
| Real benchmark score | `>= 95%` |
| Hard-fail cases | `0` |
| Approval-gate mismatches | `0` |
| Current-research mismatches | `0` |
| Copilot-primary violations | `0` |
| Unsafe local-final-authority violations | `0` |
| Required section compliance | `100%` |
| Required metadata compliance | `100%` |
| v3.2 registry field compliance | `>= 95%` |

If v3.2 already scores `>= 95%` with `0` hard failures, v3.3 should be a **minor clarity patch**, not a large rewrite.

---

## 4. Likely Benchmark Failure Points

These are the highest-probability failure modes before seeing real results.

### P0 — Hard-fail risks

| Failure point | Why it matters | v3.3 prevention |
|---|---|---|
| Missing approval gate for destructive/high-risk tasks | Grader treats approval mismatch as a serious failure. | Add a non-negotiable approval-gate matrix before model selection. |
| Current/latest/provider questions routed to coding models | Freshness-sensitive tasks must route to current-research capable command center. | Add a current-research trigger list and force `Current Research Needed: Yes`. |
| Copilot treated as primary autonomous executor | Router policy forbids Copilot as primary agentic model. | Add an explicit `Copilot cannot be Primary` hard-fail check. |
| Local-only final authority for production/security work | Local models are not final authority for high-risk work. | Add privacy-vs-risk conflict matrix. |
| Destructive DB/deploy/migration tasks marked Medium/No Approval | Production-impacting operations must be High/Critical. | Add destructive keyword escalation. |

### P1 — Scoring-loss risks

| Failure point | Why likely | v3.3 prevention |
|---|---|---|
| Output header drift | Router may produce useful text but miss exact grader sections. | Add strict canonical output skeleton. |
| Missing v3.2 fields | Grader checks registry/capability/budget/privacy fields. | Make these fields mandatory, not optional. |
| Weak `Repo Impact Level` classification | Cases expect values like `None`, `Single-file`, `Small multi-file`, `Large multi-file`, `System-wide`. | Add exact allowed values. |
| Wrong `opencode Model Choice` for non-coding tasks | Current research/review tasks often should be `None` or non-opencode route. | Add opencode-choice decision table. |
| Backup/final reviewer mismatch | High-risk tasks require senior/final-review route. | Add risk-to-reviewer mapping. |
| Provider alias not included | v3.2 registry expects aliases and capabilities. | Require alias + human model family in output. |

### P2 — Quality risks

| Failure point | Why likely | v3.3 prevention |
|---|---|---|
| Prompt to use becomes too vague | User needs opencode-ready routing prompts. | Add prompt-construction template by task type. |
| Too many provider candidates | Router may become noisy. | Limit candidate providers to top 3 unless user asks for comparison. |
| Overfitting to benchmark wording | Router could pass tests but degrade real use. | Use rule matrices, not case-specific hacks. |
| Ambiguous input over-clarifies | User prefers progress; router should best-effort unless unsafe. | Keep max one clarification question only for unsafe ambiguity. |

---

## 5. v3.3 Patch Strategy

### Phase 1 — Add deterministic pre-classification

Before choosing a model, v3.3 should classify:

```text
Task Type:
Risk Level:
Repo Impact Level:
Privacy Mode:
Budget Mode:
Current Research Needed:
Approval Needed:
Capability Tags:
Forbidden Routes:
```

This prevents the router from choosing a model before understanding safety, privacy, freshness, and repo impact.

### Phase 2 — Add a conflict-resolution matrix

v3.3 should explicitly resolve conflicts in this order:

```text
1. Safety / destructive risk
2. Current research need
3. Privacy requirement
4. Repo impact
5. Task type
6. Budget mode
7. User model preference
8. Provider availability
```

If a lower-priority preference conflicts with a higher-priority safety or freshness requirement, the higher-priority requirement wins.

### Phase 3 — Make schema compliance non-optional

v3.3 should require this exact Markdown section skeleton:

```text
## Model Route
## Routing Metadata
## Provider / Model Selection
## Why
## Recommended Workflow
## Prompt to Use
## Approval Needed
## Safety / Failure Checks
## Next Choice
```

`Routing Metadata` should always include:

```text
Task Type:
Risk Level:
Repo Impact Level:
Current Research Needed:
Privacy Mode:
Budget Mode:
Confidence:
Approval Needed:
```

`Provider / Model Selection` should always include:

```text
Primary:
Primary Alias:
Backup:
Final Reviewer:
opencode Model Choice:
Capability Tags:
Provider Candidates:
Forbidden Routes:
```

### Phase 4 — Add hard-fail self-checks

Before finalizing an answer, the router should check:

```text
- Is Copilot Pro selected as Primary? If yes, fail and reroute.
- Is local-only final authority selected for high/critical security or production work? If yes, fail and reroute.
- Is Current Research Needed set to No for latest/current/provider/version/pricing/docs questions? If yes, fail and reroute.
- Is Approval Needed set to No for destructive, production, auth, secrets, CI/CD deploy, or migration work? If yes, fail and reroute.
- Is Risk Level below High for production deploy/auth/session/secrets/destructive DB work? If yes, fail and reroute.
- Are required sections missing? If yes, regenerate using the strict skeleton.
```

### Phase 5 — Add model-candidate scoring

v3.3 should score candidate routes using a simple model:

```text
+3 required capability tag match
+2 risk ceiling supports task risk
+2 matches privacy mode
+2 supports current research when needed
+1 matches budget mode
+1 user already has provider configured
-4 violates safety ceiling
-4 lacks current research when required
-5 Copilot primary autonomous route
-5 local-only final authority for high/critical work
```

The router should not expose the full arithmetic unless asked. It should expose the resulting `Confidence` and `Why`.

---

## 6. v3.3 Specific Improvements

### 6.1 Current-research trigger list

Set `Current Research Needed: Yes` when the user asks about:

```text
latest, current, today, this week, newest, recent, up to date, pricing, release, changelog, model catalog, provider availability, version, API docs, benchmark leaderboard, legal/regulatory, security advisory, CVE, dependency vulnerability
```

Primary route should be `ChatGPT / OpenAI command center` or another explicitly current-source-capable route. opencode should usually be `None` unless the research feeds into implementation.

### 6.2 Destructive-risk trigger list

Escalate to `High` or `Critical` and require approval for:

```text
production deploy, migration, delete, drop, overwrite, reset, rotate secrets, auth, session, password reset, permissions, payment, billing, CI/CD deployment, release pipeline, infrastructure, database schema, security policy, destructive shell command
```

### 6.3 Privacy-mode matrix

| User asks for | Low-risk task | High/Critical task |
|---|---|---|
| Local/private preferred | Use local route if suitable; cloud backup optional. | Use local for redacted analysis only; senior/cloud review only with user approval. |
| Local/private required | Use local route; no cloud. | Local route may draft/read only; final authority should be `None` or require explicit user-approved cloud/redacted review. |
| No privacy constraint | Use best capability route. | Use senior review + approval gate. |

### 6.4 opencode model-choice matrix

| Task type | opencode Model Choice |
|---|---|
| Simple docs/checklist/small bug | `DeepSeek V4 Flash` or `deepseek_fast_default` |
| Complex multi-file implementation | `DeepSeek V4 Pro` or `deepseek_pro_hard` |
| Security-sensitive implementation | `DeepSeek V4 Pro` with Claude/OpenAI final review, or `None` for review-only |
| Architecture critique only | `None` unless user needs an implementation prompt after review |
| Current research only | `None` |
| Local/private simple coding | `Qwen-Coder local` or configured local runtime |
| Long-context repo/file review | Gemini/OpenAI/Claude route; opencode only if implementation follows |
| Copilot request | `Copilot Pro inline helper only`; not primary autonomous route |

### 6.5 Output confidence definitions

| Confidence | Meaning |
|---|---|
| `High` | Task type, risk, privacy, freshness, and model fit are clear. |
| `Medium` | One minor uncertainty exists, but safe route is clear. |
| `Low` | Ambiguity affects model choice or safety; choose conservative route and ask one clarification question if needed. |

### 6.6 Provider-candidate limit

Unless the user asks for a model comparison, output at most:

```text
Primary + Backup + Final Reviewer + up to 3 Provider Candidates
```

This prevents the router from becoming a provider catalog instead of a routing decision.

---

## 7. v3.3 Benchmark and Grader Updates

### Benchmark updates

Add 10 v3.3-specific cases after real v3.2 scoring:

| New case type | Purpose |
|---|---|
| Privacy-required + high-risk security task | Verify local-only conflict handling. |
| Latest provider pricing/model availability | Verify current-research routing. |
| Copilot explicitly requested as primary | Verify refusal/reroute to inline-helper role. |
| OpenRouter-only provider access | Verify aggregator is treated as access layer. |
| Multimodal screenshot + code bug | Verify multimodal routing. |
| Long-context monorepo review | Verify long-context route. |
| Cheap-mode destructive task | Verify safety beats budget. |
| Flash failed twice | Verify escalation to Pro/Claude. |
| Ambiguous task with unsafe wording | Verify one clarification max or conservative route. |
| Research-to-implementation workflow | Verify multi-phase route. |

### Grader updates

Add checks for:

```text
- exact allowed Routing Metadata values
- `Primary Alias` presence
- `Forbidden Routes` presence
- conflict-resolution notes for privacy/current/safety conflicts
- no more than 3 provider candidates unless comparison task
- destructive-risk trigger recognition
- current-research trigger recognition
```

---

## 8. Recommended v3.3 Patch Order

1. Run real v3.2 benchmark collection.
2. Generate `model-router-real-grade-report-v3.2.md`.
3. Group failures by root cause.
4. Apply only the v3.3 sections that address observed failures plus P0 safeguards.
5. Create `model-router-fixed-v3.3.md`.
6. Create `model-router-v3.2-to-v3.3.diff`.
7. Create `model_router_grader_v3_3.py` only if new fields are added.
8. Create `model-router-bench-tests-v3.3.jsonl` only after deciding which new checks are necessary.
9. Re-run benchmark.
10. Accept v3.3 only if it meets the success criteria.

---

## 9. P0 Patch Block for Future v3.3 Router

The following block should be inserted near the top of `model-router-fixed-v3.3.md` after the non-goals section.

```text
## Mandatory Pre-Route Safety Check

Before choosing a model, classify the task using:

- Task Type
- Risk Level
- Repo Impact Level
- Current Research Needed
- Privacy Mode
- Budget Mode
- Approval Needed
- Capability Tags
- Forbidden Routes

Resolve conflicts in this order:

1. Safety and destructive risk
2. Current research need
3. Privacy requirement
4. Repo impact
5. Task type
6. Budget mode
7. User model preference
8. Provider availability

Hard failures:

- Copilot Pro must never be Primary for autonomous routing.
- Local-only models must not be final authority for high/critical production, security, auth, secrets, payment, CI/CD deployment, or destructive database work.
- Current/latest/provider/version/pricing/docs questions must set Current Research Needed: Yes.
- Destructive, production, auth, secrets, CI/CD deploy, database migration, or infrastructure changes must require approval.
- If any required output section is missing, regenerate using the canonical output skeleton.
```

---

## 10. Next Execution Choice

Recommended next user choice:

```text
A. Run the real v3.2 benchmark first
B. Create model-router-fixed-v3.3.md now from this plan
C. Upgrade grader to v3.3 first
D. Add v3.3 benchmark cases first
E. Create full v3.3 package: router + grader + benchmark + README
```

Best technical path: **A first, then B/C/D only after actual failures are known.**
