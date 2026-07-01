# Model Router v3 — LLM Expansion Integration Plan

## Goal

Integrate more LLM choices without breaking the current routing guarantees:

- DeepSeek V4 Flash remains the default normal opencode coding engine.
- DeepSeek V4 Pro remains the hard opencode coding engine.
- Claude remains the senior architecture/review route.
- ChatGPT/OpenAI remains command center, current research, planning, synthesis, and final verification.
- Qwen/local models remain private/offline/light fallback.
- Copilot Pro remains inline helper only.

## Core Design

Do not hardcode every model into the routing ladder. Add a provider registry and route by capability tags.

### Provider Registry Fields

Each provider/model entry should include:

| Field | Purpose |
|---|---|
| `provider_id` | Stable provider key such as `openai`, `anthropic`, `google`, `deepseek`, `xai`, `mistral`, `qwen_local`, `ollama_local`, `github_copilot`. |
| `display_name` | Human-readable model family or configured exact model name. |
| `configured_slug` | Exact API/opencode/local model slug, if known. |
| `capability_tags` | Routing tags such as `coding_fast`, `coding_deep`, `current_research`, `architecture_review`. |
| `risk_ceiling` | Maximum risk level this model may handle as primary: Low, Medium, High, Critical. |
| `final_authority_allowed` | Whether it may be final reviewer for High/Critical work. |
| `privacy_class` | `cloud`, `enterprise`, `local`, or `unknown`. |
| `cost_class` | `cheap`, `balanced`, `premium`, or `unknown`. |
| `context_class` | `normal`, `long`, `very-long`, or `unknown`. |
| `tool_capability` | `none`, `tools`, `web`, `code`, `multimodal`, or combined tags. |
| `opencode_support` | `native`, `api`, `manual`, `none`, or `unknown`. |
| `fallback_order` | Ordered fallback model/provider ids. |
| `last_verified` | Date this entry was checked. |
| `notes` | Constraints, known failure modes, or routing comments. |

## Capability Tags

Use these tags as the router’s stable abstraction layer:

| Tag | Meaning |
|---|---|
| `coding_fast` | Cheap/fast normal implementation. |
| `coding_deep` | Complex implementation, repo-wide changes, difficult debugging. |
| `architecture_review` | Design critique and maintainability reasoning. |
| `security_review` | Auth, permissions, secrets, security-sensitive review. |
| `current_research` | Current docs, latest releases, pricing, web verification. |
| `long_context` | Large repo/file/document analysis. |
| `multimodal` | Images, screenshots, PDFs, visual UI analysis. |
| `local_private` | Offline/private/local-only work. |
| `cheap_bulk` | Low-cost bulk docs or repetitive edits. |
| `final_verification` | Final audit/check before implementation or release. |
| `inline_completion` | IDE autocomplete or small inline suggestions. |
| `tool_calling` | Function/tool/MCP/API workflow support. |

## Initial Expansion Matrix

| Provider / Family | Add as | Primary Uses | Guardrails |
|---|---|---|---|
| OpenAI / ChatGPT / GPT | Command + verification route | Planning, current research, final audit, multimodal, complex reasoning | Do not use stale knowledge for current docs. Require source verification for current claims. |
| Anthropic / Claude | Senior review route | Architecture critique, security review, maintainability, hard reasoning | Use implementation model after review if actual coding is needed. |
| Google / Gemini | Long-context + multimodal + research route | Large repo/file analysis, multimodal inputs, grounded research when enabled | Verify exact model availability and context limits before pinning slugs. |
| DeepSeek | Coding route | Flash for normal opencode coding; Pro for complex repo work | Escalate Pro for multi-file/high-risk work. |
| xAI / Grok | Alternate current-research route | Web-assisted current checks, second-opinion reasoning | Use as backup unless configured and trusted for the task. |
| Mistral / Codestral | Provider-diverse coding fallback | Code generation, tool-calling, cost-aware implementation | Do not override DeepSeek default unless benchmarked better for the repo. |
| Qwen / Qwen-Coder local | Local/private route | Offline/private docs/code explanation and small drafts | Never sole final authority for High/Critical work. |
| Llama / Gemma / other Ollama models | Local fallback route | Local summarization, explanation, light code drafts | Require cloud/senior review for non-trivial or risky work. |
| GitHub Copilot Pro | Inline helper only | Autocomplete, small inline suggestions in IDE | Never primary autonomous repo agent. |

## Routing Algorithm

1. Classify the task:
   - task type
   - risk level
   - repo impact level
   - privacy mode
   - budget mode
   - current research need
   - multimodal/long-context/tool-use need

2. Convert task requirements into required capability tags.

3. Filter provider registry:
   - model has required tags
   - model risk ceiling is high enough
   - privacy class satisfies the task
   - model is available/configured
   - budget class is acceptable

4. Apply safety gates:
   - High/Critical tasks require approval.
   - High/Critical tasks require senior final review.
   - Local-only models cannot be final authority for risky work.
   - Copilot cannot be autonomous primary.
   - Current-research tasks require a current-source-capable route.

5. Rank candidates:
   - current project default wins when safe
   - lower cost wins for Low/Medium cheap/bulk tasks
   - premium reasoning wins for High/Critical or prior failure
   - local wins only when privacy/offline requirement is explicit

6. Emit route with confidence and failure flags.

## Example Registry Snippet

```json
[
  {
    "provider_id": "deepseek_flash",
    "display_name": "DeepSeek V4 Flash",
    "configured_slug": "",
    "capability_tags": ["coding_fast", "cheap_bulk", "tool_calling"],
    "risk_ceiling": "Medium",
    "final_authority_allowed": false,
    "privacy_class": "cloud",
    "cost_class": "cheap",
    "context_class": "long",
    "tool_capability": ["tools", "code"],
    "opencode_support": "api",
    "fallback_order": ["deepseek_pro", "claude", "openai"],
    "last_verified": "2026-06-27",
    "notes": "Default normal opencode coding route. Escalate on complex, high-risk, or failed attempts."
  },
  {
    "provider_id": "claude_senior_review",
    "display_name": "Claude",
    "configured_slug": "",
    "capability_tags": ["architecture_review", "security_review", "final_verification", "coding_deep"],
    "risk_ceiling": "Critical",
    "final_authority_allowed": true,
    "privacy_class": "cloud",
    "cost_class": "premium",
    "context_class": "long",
    "tool_capability": ["tools"],
    "opencode_support": "manual",
    "fallback_order": ["openai", "deepseek_pro"],
    "last_verified": "2026-06-27",
    "notes": "Best used for critique, architecture, maintainability, and security review."
  }
]
```

## v4 Upgrade Path

### Phase 1 — Static Registry

Create a `model-router-provider-registry.json` file with provider entries and capability tags. The router references this registry conceptually.

### Phase 2 — Score-Based Candidate Ranking

Add a scoring formula:

```text
score = capability_match + safety_fit + cost_fit + privacy_fit + context_fit + tool_fit - risk_penalty - uncertainty_penalty
```

### Phase 3 — Provider Availability Check

Before recommending exact slugs, check whether the model is configured in opencode, API keys exist, or the local model is installed.

### Phase 4 — Benchmarked Overrides

Allow repo-specific overrides only after benchmark evidence. Example:

```json
{
  "repo": "agent-workbench",
  "preferred_coding_fast": "deepseek_flash",
  "preferred_coding_deep": "deepseek_pro",
  "preferred_architecture_review": "claude",
  "preferred_long_context": "gemini",
  "preferred_current_research": "openai"
}
```

### Phase 5 — Continuous Evaluation

Run the v3 grader whenever a provider is added. Add at least 3 benchmark cases per new provider:

1. Best-fit case.
2. Unsafe-overuse trap.
3. Fallback/unavailable case.

## Acceptance Criteria

The expanded router is successful only if:

- Existing DeepSeek/Claude/ChatGPT/Qwen/Copilot routing rules still pass.
- New providers are routed by capability, not hype.
- Current research uses current-source-capable routes.
- High/Critical tasks still require approval.
- Copilot is never autonomous primary.
- Local models are never sole final reviewer for High/Critical tasks.
- Every new model has fallback rules and a verification date.
