# Model Router Expanded LLM Registry v1

**Generated:** 2026-06-26 America/Chicago  
**Target router:** `model-router-fixed-v3.1.md`  
**Purpose:** Add more LLM choices without weakening the router into a brittle, hype-driven model list.

---

## 1. Design Rule

The router must select models by **capability class**, not by brand preference.

Use this decision chain:

```text
Task → Risk → Privacy → Current-info need → Repo impact → Budget mode → Capability tags → Candidate model → Backup → Final reviewer
```

Do **not** route directly from prompt wording to a model name unless the user explicitly requests that model and the request is safe.

---

## 2. Canonical Capability Tags

| Tag | Meaning | Typical use |
|---|---|---|
| `command_center` | Planning, coordination, final synthesis | ChatGPT-style planning, handoffs, reports |
| `coding_fast` | Fast implementation/editing loop | Normal opencode code changes |
| `coding_deep` | Hard implementation, multi-file refactor, complex debugging | Large repo changes, API design, agent workflows |
| `agentic_coding` | Long-horizon coding with tools and iteration | autonomous coding agents, multi-step implementation |
| `architecture_review` | Senior critique and design review | architecture, maintainability, tradeoffs |
| `security_review` | Security-sensitive review | auth, sessions, secrets, CI/CD, deployment |
| `current_research` | Needs current web/provider/product info | model comparisons, docs, API changes |
| `long_context` | Very large context/codebase/document intake | repo-wide understanding, long logs |
| `multimodal` | Image/PDF/audio/video input support | screenshots, diagrams, PDFs, media |
| `local_private` | Local/offline/private routing | sensitive files, offline fallback, budget preservation |
| `cheap_bulk` | High-volume low-risk tasks | repetitive docs edits, simple transforms |
| `structured_output` | Reliable JSON/schema output | grader/test harness generation |
| `final_verification` | Final review and answer correctness check | audit, release decision, final acceptance |
| `inline_ide_helper` | IDE completion only, not primary planner/executor | Copilot-style autocomplete and local IDE edits |

---

## 3. Risk Limits

| Risk level | Allowed primary classes | Disallowed primary classes | Required review |
|---|---|---|---|
| Low | `coding_fast`, `cheap_bulk`, `local_private`, `inline_ide_helper` | none unless destructive | optional |
| Medium | `coding_deep`, `agentic_coding`, `architecture_review` | weak local-only final authority | final verification recommended |
| High | `coding_deep`, `security_review`, `architecture_review`, `command_center` | `cheap_bulk`, `inline_ide_helper`, local-only final authority | required |
| Critical | `command_center` + senior reviewer + implementation model | any single-model autonomous execution | required before execution and after output |

High/Critical examples:

- auth/session/security logic
- secrets or credentials
- deployment/production configuration
- CI/CD mutation
- destructive commands
- database migration
- billing/payment code
- large multi-file refactor
- model-router or agent-safety logic

---

## 4. Provider Registry

### 4.1 OpenAI

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `openai_frontier_reasoning` | GPT-5.5 / GPT-5.5 Pro class | `command_center`, `coding_deep`, `current_research`, `long_context`, `multimodal`, `structured_output`, `final_verification` | complex planning, hard coding, final verification, current research | Critical with approval | Use when highest correctness matters. |
| `openai_balanced_coding` | GPT-5.4 class | `coding_deep`, `agentic_coding`, `structured_output`, `long_context` | complex coding with lower cost than flagship | High with review | Good second-choice for hard code workflows. |
| `openai_fast_mini` | GPT-5.4 mini / GPT-5 mini class | `coding_fast`, `cheap_bulk`, `structured_output`, `inline_ide_helper` | fast code iteration, simple fixes, subagents | Medium | Do not use as final authority for high-risk work. |
| `openai_nano_bulk` | GPT-5.4 nano class | `cheap_bulk`, `structured_output` | simple transformations and classification | Low | Not for architecture/security decisions. |
| `openai_codex_agent` | GPT-5.3-Codex / Codex-class | `agentic_coding`, `coding_deep`, `structured_output` | coding-agent execution | High with review | Use only when tool/runtime integration supports it. |

### 4.2 Anthropic Claude

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `claude_max_reasoning` | Claude Fable 5 / Claude Opus 4.8 class | `architecture_review`, `security_review`, `coding_deep`, `agentic_coding`, `long_context`, `final_verification` | senior review, hard reasoning, high-autonomy coding critique | Critical with approval | Strong final reviewer for major repo changes. |
| `claude_balanced_agent` | Claude Sonnet 4.6 class | `coding_deep`, `architecture_review`, `agentic_coding`, `structured_output` | agentic coding and design critique | High with review | Good primary or backup for complex coding. |
| `claude_fast_subagent` | Claude Haiku 4.5 class | `coding_fast`, `cheap_bulk`, `structured_output` | low-cost subagent or fast pass | Medium | Not final authority for high-risk work. |

### 4.3 Google Gemini

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `gemini_deep_context` | Gemini 2.5 Pro / Gemini 3.1 Pro class | `long_context`, `coding_deep`, `multimodal`, `structured_output`, `current_research` | large-codebase analysis, multimodal docs, long context | High with review | Prefer for long repo/document ingestion. |
| `gemini_fast_agent` | Gemini 3.5 Flash / Gemini Flash class | `coding_fast`, `agentic_coding`, `multimodal`, `cheap_bulk`, `structured_output` | fast agent loops and high-volume multimodal work | Medium | Good alternate to DeepSeek Flash. |
| `gemini_budget_lite` | Gemini Flash-Lite class | `cheap_bulk`, `multimodal`, `structured_output` | low-risk high-frequency extraction and transforms | Low | Avoid high-risk final decisions. |
| `gemini_deep_research` | Gemini Deep Research class | `current_research`, `long_context`, `final_verification` | multi-source research and cited synthesis | High with final review | Use when research report quality matters. |

### 4.4 DeepSeek

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `deepseek_fast_default` | DeepSeek V4 Flash | `coding_fast`, `cheap_bulk`, `agentic_coding`, `structured_output` | default opencode implementation loop | Medium | Keep as default code executor unless task is high-risk or complex. |
| `deepseek_pro_hard` | DeepSeek V4 Pro | `coding_deep`, `agentic_coding`, `structured_output` | hard opencode implementation and complex repo work | High with final review | Escalate here after Flash failure/looping. |
| `deepseek_reasoning_compat` | DeepSeek reasoner compatibility route | `coding_deep`, `structured_output` | legacy compatibility only | Medium | `deepseek-reasoner` name is deprecated; prefer V4 family naming. |

### 4.5 xAI Grok

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `grok_general_agent` | Grok 4.3 class | `command_center`, `coding_deep`, `long_context`, `structured_output` | general agentic reasoning and tool calling | High with review | Do not assume current knowledge unless search tools are enabled. |
| `grok_build_coding` | Grok Build 0.1 class | `coding_fast`, `agentic_coding`, `coding_deep` | coding agent workflows | High with review | Coding-specialized candidate/backup. |

### 4.6 Mistral

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `mistral_agentic_coding` | Devstral / Mistral Medium coding class | `coding_deep`, `agentic_coding`, `structured_output` | coding-agent implementation and repo tasks | High with review | Good sovereign/open-weight-friendly option. |
| `mistral_balanced_general` | Mistral Medium / Large / Small class | `coding_fast`, `architecture_review`, `multimodal`, `cheap_bulk` | balanced general tasks | Medium | Use when deployment or provider diversification matters. |
| `mistral_local_candidate` | Open-weight Mistral models | `local_private`, `cheap_bulk`, `coding_fast` | local/offline fallback | Medium | Never final authority for high-risk production changes. |

### 4.7 Qwen / Alibaba

| Router alias | Candidate model family | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `qwen_coder_local` | Qwen3-Coder / Qwen3-Coder-Next | `local_private`, `coding_fast`, `agentic_coding`, `long_context` | local/private coding, repo explanation, low/medium implementation | Medium | Strong local coding candidate. Not final authority for security/production changes. |
| `qwen_large_agent` | Qwen3-Coder large class | `coding_deep`, `agentic_coding`, `long_context` | complex open-weight coding | High with final review | Use if hardware/provider supports it. |

### 4.8 Local runners

| Router alias | Candidate runtime | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `ollama_local_runtime` | Ollama local API | `local_private`, `cheap_bulk`, `coding_fast` | offline/private coding and explanation | Medium | Requires installed model and adequate RAM/VRAM. |
| `llama_cpp_runtime` | llama.cpp local runtime | `local_private`, `cheap_bulk` | constrained local inference | Low/Medium | Best for smaller local models. |
| `vllm_local_server` | vLLM local/server runtime | `local_private`, `coding_fast`, `coding_deep` | higher-throughput self-hosted inference | High with review | Requires stronger hardware/admin setup. |
| `lm_studio_local_runtime` | LM Studio local server | `local_private`, `cheap_bulk`, `coding_fast` | GUI-managed local models | Medium | Good user-facing local model manager. |

### 4.9 GitHub Copilot

| Router alias | Candidate environment | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `copilot_inline_only` | Copilot IDE completion/chat model picker | `inline_ide_helper` | autocomplete, small IDE suggestions, local edit assistance | Low/Medium | Never route Copilot as the sole primary planner/executor for repo-wide, security, CI/CD, destructive, or high-risk work. |

### 4.10 OpenRouter / aggregator layer

| Router alias | Candidate environment | Capability tags | Best route | Risk ceiling | Notes |
|---|---|---|---|---|---|
| `openrouter_provider_switch` | OpenRouter models API | provider-dependent | model comparison, fallback routing, cost-aware dispatch | depends on selected model | Use as an access layer, not a capability guarantee. The router must inspect the chosen model’s tags and provider. |

---

## 5. Router Selection Matrix

| Task pattern | Primary class | Backup class | Final reviewer | Approval |
|---|---|---|---|---|
| Simple docs/readme edit | `deepseek_fast_default` or `openai_fast_mini` | `gemini_fast_agent` | optional `command_center` | No |
| Normal opencode implementation | `deepseek_fast_default` | `deepseek_pro_hard` | optional ChatGPT/Claude | Maybe |
| Multi-file refactor | `deepseek_pro_hard` or `openai_balanced_coding` | `claude_balanced_agent` | `claude_max_reasoning` or `openai_frontier_reasoning` | Yes |
| Auth/session/security | `deepseek_pro_hard` or `openai_frontier_reasoning` | `claude_max_reasoning` | `claude_max_reasoning` + `command_center` | Yes |
| Architecture critique | `claude_max_reasoning` | `openai_frontier_reasoning` | ChatGPT | No unless implementation follows |
| Current model/provider research | `openai_frontier_reasoning` or `gemini_deep_research` | `grok_general_agent` with search enabled | ChatGPT | No |
| Long repo/document analysis | `gemini_deep_context` or `openai_frontier_reasoning` | `claude_max_reasoning` | ChatGPT/Claude | Maybe |
| Private/offline local task | `qwen_coder_local` or `ollama_local_runtime` | cloud model only with user approval | ChatGPT/Claude if high risk | Maybe |
| Cheap batch classification | `openai_nano_bulk`, `gemini_budget_lite`, or `deepseek_fast_default` | `claude_fast_subagent` | optional | No |
| Copilot IDE autocomplete | `copilot_inline_only` | opencode model if task grows | ChatGPT/Claude if risk grows | No |

---

## 6. Budget Modes

### Budget Mode: Cheap

Prefer:

1. DeepSeek V4 Flash
2. Gemini Flash / Flash-Lite
3. OpenAI mini/nano class
4. Claude Haiku class
5. Local Qwen/Ollama for private or repeatable work

Escalate only when:

- task is high risk
- primary fails twice
- repo impact becomes multi-file
- user requests senior review

### Budget Mode: Balanced

Prefer:

1. DeepSeek V4 Flash for normal coding
2. DeepSeek V4 Pro for hard coding
3. Claude Sonnet/Opus or OpenAI frontier for review
4. Gemini for long context/multimodal
5. Local Qwen for private/offline work

### Budget Mode: Maximum Correctness

Prefer:

1. ChatGPT/OpenAI frontier for command center and verification
2. Claude Opus/Fable class for architecture/security critique
3. DeepSeek Pro or Codex-class for implementation
4. Gemini Pro/Deep Research for long context/current research
5. Require approval and final review for high-risk work

---

## 7. Provider Entry Template

Use this format when adding a new LLM:

```yaml
- router_alias: provider_model_role
  provider: ProviderName
  model_family: Exact model or model family
  current_model_ids:
    - model-id-here
  capability_tags:
    - coding_fast
    - structured_output
  best_for:
    - short concrete use case
  avoid_for:
    - short concrete anti-use case
  risk_ceiling: Low | Medium | High | Critical with approval
  privacy_mode: cloud | local | hybrid
  budget_tier: cheap | balanced | premium
  current_info_policy: needs_search | static_ok | provider_dependent
  final_authority_allowed: true | false
  notes: short operational note
```

---

## 8. Hard Fail Rules

The router output is wrong if it does any of these:

1. Routes a destructive, security, auth, deployment, migration, or production-impacting task to a cheap/local/inline-only model without approval.
2. Uses Copilot as sole primary executor for repo-wide work.
3. Uses a local model as final authority for high-risk production work.
4. Recommends deprecated model IDs when a stable replacement is known.
5. Treats OpenRouter/aggregators as a model instead of an access layer.
6. Performs the coding/research task instead of routing it.
7. Ignores explicit privacy/offline constraints.
8. Ignores current-research requirements for providers, pricing, docs, APIs, or model availability.
9. Omits backup and final-review model for medium/high/critical tasks.
10. Omits approval requirement for high/critical tasks.

---

## 9. Integration Patch for `model-router-fixed-v3.1.md`

Add this section after the v3.1 provider-registry section:

```markdown
## Expanded LLM Registry Policy

When more model choices are available, select by capability tags and risk ceiling. Do not select by brand popularity.

Resolution order:
1. Apply Safety Override Pre-Checks.
2. Classify task type and repo impact.
3. Determine privacy/current-info constraints.
4. Select the required capability tags.
5. Filter candidates by risk ceiling.
6. Filter by budget mode.
7. Pick primary, backup, and final reviewer.
8. If exact model availability is unknown, output the model family and state that availability must be verified in the active provider/client.

Never hardcode a stale model as mandatory. Use exact model IDs only when the runtime/provider confirms availability.
```

---

## 10. Maintenance Checklist

Run monthly or before major router changes:

```text
1. Check official provider model catalogs.
2. Mark deprecated or retired models.
3. Update aliases and candidate families.
4. Run benchmark JSONL through the router.
5. Grade real outputs.
6. Patch weak routing cases.
7. Save grade report and changelog.
```

---

## 11. Source Notes Checked

Official/current references consulted while creating this registry:

- OpenAI API model documentation: https://developers.openai.com/api/docs/models
- Anthropic Claude model documentation: https://platform.claude.com/docs/en/about-claude/models/overview
- Gemini API model documentation: https://ai.google.dev/gemini-api/docs/models
- DeepSeek API docs: https://api-docs.deepseek.com/
- xAI model docs: https://docs.x.ai/developers/models
- Mistral model docs: https://docs.mistral.ai/models/overview
- Qwen3-Coder repository: https://github.com/QwenLM/Qwen3-Coder
- Ollama API docs: https://docs.ollama.com/api/introduction
- GitHub Copilot supported models docs: https://docs.github.com/en/copilot/reference/ai-models/supported-models
- OpenRouter model routing docs: https://openrouter.ai/docs/guides/overview/models

