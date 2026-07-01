# model-router-fixed-v3.2 Change Log

## Summary

Created `model-router-fixed-v3.2.md` by integrating the expanded LLM registry into the v3.1 router prompt.

## Source Files Used

- `model-router-fixed-v3.1.md`
- `model-router-expanded-llm-registry-v1.md`
- `model-router-expanded-llm-registry-v1.json`

## v3.2 Changes

### Added

- Built-in expanded provider registry.
- Capability-tag selection layer.
- Provider-agnostic router aliases.
- Provider availability fallback rules.
- Registry maintenance rule.
- Registry source notes.
- Additional task type: `model-selection`.
- Additional routing priority: provider-registry update / model-selection question.
- `Capability Tags` and `Provider Registry Match` metadata fields.

### Strengthened

- The distinction between model family, exact configured model ID, and router alias.
- Aggregator safety handling for OpenRouter-style routing.
- Copilot restriction language.
- Current-research requirements for latest model/provider/API questions.
- Local/private conflict handling for high-risk tasks.
- Bad-route automatic failures.

### Preserved

- v3/v3.1 grader-compatible required sections:
  - `Model Route`
  - `Routing Metadata`
  - `Why`
  - `Recommended Workflow`
  - `opencode Model Choice`
  - `Additional Provider Candidates`
  - `Prompt to Use`
  - `Approval Needed`
  - `Failure Flags`
  - `Next Choice`

## Validation Performed

- Verified required section headers exist.
- Verified required routing metadata fields exist.
- Generated a unified diff from v3.1 to v3.2.
- Packaged v3.2 with the registry and benchmark/grader support files.

## Not Yet Done

- Real benchmark scoring against actual v3.2 router outputs.
- Grader upgrade specifically for expanded provider-registry fields.
- opencode-ready folder layout.

## Recommended Next Step

Upgrade the grader to score expanded-LLM routing fields, then run a real benchmark using `model-router-bench-tests-v3.jsonl`.
