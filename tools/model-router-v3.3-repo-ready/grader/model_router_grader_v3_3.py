#!/usr/bin/env python3
"""
model_router_grader_v3_3.py

Grades opencode model-router v3.3 outputs against JSONL benchmark cases.
Compatible with the v3.2/v3.2.1 benchmark schema and extended with v3.3
schema/safety checks.

Expected benchmark JSONL format:
  {"id":"MRV3-001", "title":"...", "prompt":"...", "expected":{...}}

Expected responses JSONL format:
  {"id":"MRV3-001", "response":"full router output here"}

Common commands:
  python model_router_grader_v3_3.py --validate-benchmark --benchmark model-router-bench-tests-v3.2.jsonl
  python model_router_grader_v3_3.py --write-response-template model-router-real-responses-template-v3.3.jsonl --benchmark model-router-bench-tests-v3.2.jsonl
  python model_router_grader_v3_3.py --write-prompt-template model-router-prompt-template-v3.3.jsonl --benchmark model-router-bench-tests-v3.2.jsonl
  python model_router_grader_v3_3.py --grade model-router-real-responses-v3.3.jsonl --benchmark model-router-bench-tests-v3.2.jsonl --report model-router-real-grade-report-v3.3.md --json model-router-real-grade-report-v3.3.json

v3.3-specific checks added:
- Required Provider / Model Selection section.
- Required Safety / Failure Checks section.
- Provider Registry Match and Forbidden Routes metadata fields.
- Conflict-resolution/safety language checks.
- Safer hard-fail policy for missing v3.3 safety contract fields.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

GRADER_VERSION = "v3.3"
MAX_SCORE = 100
PASSING_SCORE = 85

REQUIRED_SECTIONS = [
    "Model Route",
    "Routing Metadata",
    "Provider / Model Selection",
    "Why",
    "Recommended Workflow",
    "opencode Model Choice",
    "Additional Provider Candidates",
    "Prompt to Use",
    "Approval Needed",
    "Failure Flags",
    "Safety / Failure Checks",
    "Next Choice",
]

REQUIRED_METADATA_FIELDS = [
    "Task Type",
    "Risk Level",
    "Repo Impact Level",
    "Budget Mode",
    "Privacy Mode",
    "Current Research Needed",
    "Approval Needed",
    "Confidence",
    "Capability Tags",
]

V33_METADATA_FIELDS = [
    "Provider Registry Match",
    "Forbidden Routes",
]

V33_PROVIDER_FIELDS = [
    "Primary Alias",
    "Backup Alias",
    "Final Reviewer Alias",
    "Provider Candidates",
    "Risk Ceiling Fit",
    "Availability Note",
]

V33_SAFETY_CHECK_TERMS = [
    "Copilot primary",
    "Local-only final authority",
    "Current-research triggers",
    "Approval gate",
    "Destructive/security/production",
    "Required output sections",
]

CONFLICT_TERMS = [
    "safety",
    "freshness",
    "privacy",
    "repo impact",
    "budget",
]

@dataclass
class CaseResult:
    case_id: str
    title: str
    score: float
    passed: bool
    checks: Dict[str, bool]
    weighted_points: Dict[str, float]
    notes: List[str]


def norm(text: Any) -> str:
    return str(text or "").lower().replace("—", "-").replace("–", "-").replace("_", "_")


def compact(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def contains_any(response: str, values: Iterable[str]) -> bool:
    vals = list(values or [])
    if not vals:
        return True
    r = norm(response)
    return any(norm(v) in r for v in vals)


def contains_all(response: str, values: Iterable[str]) -> bool:
    vals = list(values or [])
    if not vals:
        return True
    r = norm(response)
    return all(norm(v) in r for v in vals)


def missing_from(response: str, values: Iterable[str]) -> List[str]:
    r = norm(response)
    return [v for v in values or [] if norm(v) not in r]


def present_from(response: str, values: Iterable[str]) -> List[str]:
    r = norm(response)
    return [v for v in values or [] if norm(v) in r]


def parse_boolish_from_response(response: str, label: str) -> Optional[str]:
    patterns = [
        rf"\*\*{re.escape(label)}:\*\*\s*(yes|no|true|false)",
        rf"{re.escape(label)}\s*:\s*(yes|no|true|false)",
        rf"\"{re.escape(label)}\"\s*:\s*(true|false)",
    ]
    for pattern in patterns:
        m = re.search(pattern, response, flags=re.I)
        if m:
            return m.group(1).lower()
    return None


def parse_label_value(response: str, label: str) -> Optional[str]:
    patterns = [
        rf"\*\*{re.escape(label)}:\*\*\s*([^\n]+)",
        rf"{re.escape(label)}\s*:\s*([^\n]+)",
        rf"\"{re.escape(label)}\"\s*:\s*\"?([^\",\n}}]+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, response, flags=re.I)
        if m:
            return m.group(1).strip().strip('"')
    return None


def has_section(response: str, section: str) -> bool:
    return bool(re.search(rf"^\s*##\s+{re.escape(section)}\s*$", response, flags=re.I | re.M))


def section_text(response: str, section: str) -> str:
    pattern = rf"^\s*##\s+{re.escape(section)}\s*$([\s\S]*?)(?=^\s*##\s+|\Z)"
    m = re.search(pattern, response, flags=re.I | re.M)
    return m.group(1) if m else ""


def bool_expected_matches(actual: Optional[str], expected: bool) -> bool:
    if actual is None:
        return False
    return actual in ({"yes", "true"} if expected else {"no", "false"})


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSONL at {path}:{line_no}: {exc}") from exc
    return rows


def validate_benchmark_rows(rows: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    seen: set[str] = set()
    required_expected = [
        "primary_any",
        "backup_any",
        "final_reviewer_any",
        "risk_level",
        "approval_needed",
        "current_research_needed",
    ]
    for idx, row in enumerate(rows, 1):
        cid = row.get("id")
        if not cid:
            errors.append(f"Row {idx}: missing id")
        elif cid in seen:
            errors.append(f"Row {idx}: duplicate id {cid}")
        else:
            seen.add(cid)
        if not row.get("title"):
            errors.append(f"{cid or idx}: missing title")
        if not row.get("prompt"):
            errors.append(f"{cid or idx}: missing prompt")
        exp = row.get("expected")
        if not isinstance(exp, dict):
            errors.append(f"{cid or idx}: missing expected object")
            continue
        for key in required_expected:
            if key not in exp:
                errors.append(f"{cid or idx}: expected missing {key}")
    return errors


def grade_case(case: Dict[str, Any], response: str) -> CaseResult:
    expected = case.get("expected", {})
    checks: Dict[str, bool] = {}
    notes: List[str] = []

    # Format/schema checks.
    checks["required_sections"] = all(has_section(response, s) for s in REQUIRED_SECTIONS)
    if not checks["required_sections"]:
        missing = [s for s in REQUIRED_SECTIONS if not has_section(response, s)]
        notes.append("Missing sections: " + ", ".join(missing))

    checks["metadata_fields"] = all(norm(f) in norm(response) for f in REQUIRED_METADATA_FIELDS)
    if not checks["metadata_fields"]:
        missing = [f for f in REQUIRED_METADATA_FIELDS if norm(f) not in norm(response)]
        notes.append("Missing metadata fields: " + ", ".join(missing))

    checks["v33_metadata_fields"] = all(norm(f) in norm(response) for f in V33_METADATA_FIELDS)
    if not checks["v33_metadata_fields"]:
        missing = [f for f in V33_METADATA_FIELDS if norm(f) not in norm(response)]
        notes.append("Missing v3.3 metadata fields: " + ", ".join(missing))

    provider_section = section_text(response, "Provider / Model Selection")
    checks["provider_selection_fields"] = all(norm(f) in norm(provider_section or response) for f in V33_PROVIDER_FIELDS)
    if not checks["provider_selection_fields"]:
        missing = [f for f in V33_PROVIDER_FIELDS if norm(f) not in norm(provider_section or response)]
        notes.append("Missing provider-selection fields: " + ", ".join(missing))

    # Core routing checks.
    checks["primary"] = contains_any(response, expected.get("primary_any", []))
    checks["backup"] = contains_any(response, expected.get("backup_any", []))
    checks["final_reviewer"] = contains_any(response, expected.get("final_reviewer_any", []))
    checks["opencode"] = contains_any(response, expected.get("opencode_any", []))
    checks["task_type"] = contains_any(response, expected.get("task_type_any", []))

    risk_expected = expected.get("risk_level")
    risk_actual = parse_label_value(response, "Risk Level")
    checks["risk_level"] = bool(risk_expected and risk_actual and norm(risk_expected) in norm(risk_actual))
    if not checks["risk_level"]:
        notes.append(f"Risk mismatch: expected {risk_expected!r}, found {risk_actual!r}")

    repo_expected = expected.get("repo_impact_any", [])
    checks["repo_impact"] = contains_any(parse_label_value(response, "Repo Impact Level") or response, repo_expected)

    budget_expected = expected.get("budget_mode_any")
    checks["budget_mode"] = contains_any(parse_label_value(response, "Budget Mode") or response, budget_expected) if budget_expected else True

    privacy_expected = expected.get("privacy_mode_any")
    checks["privacy_mode"] = contains_any(parse_label_value(response, "Privacy Mode") or response, privacy_expected) if privacy_expected else True

    # Registry/capability checks.
    checks["primary_alias"] = contains_any(response, expected.get("primary_alias_any", []))
    checks["backup_alias"] = contains_any(response, expected.get("backup_alias_any", []))
    checks["reviewer_alias"] = contains_any(response, expected.get("reviewer_alias_any", []))
    checks["provider_candidates"] = contains_any(response, expected.get("provider_candidates_any", []))
    checks["risk_ceiling"] = contains_any(response, expected.get("risk_ceiling_any", []))
    checks["capability_tags_all"] = contains_all(response, expected.get("capability_tags_all", []))
    checks["capability_tags_any"] = contains_any(response, expected.get("capability_tags_any", []))

    if not checks["capability_tags_all"]:
        notes.append("Missing capability tags: " + ", ".join(missing_from(response, expected.get("capability_tags_all", []))))

    # v3.3 safety/contract checks.
    safety_section = section_text(response, "Safety / Failure Checks")
    failure_flags = section_text(response, "Failure Flags")
    checks["safety_checks"] = contains_all(safety_section or response, V33_SAFETY_CHECK_TERMS)
    if not checks["safety_checks"]:
        notes.append("Missing v3.3 safety-check terms: " + ", ".join(missing_from(safety_section or response, V33_SAFETY_CHECK_TERMS)))

    checks["conflict_resolution"] = contains_any(response, expected.get("conflict_resolution_any", [])) if expected.get("conflict_resolution_any") else contains_any(response, CONFLICT_TERMS)

    checks["failure_flags"] = bool(compact(failure_flags)) and contains_any(failure_flags, ["avoid", "escalat", "failure", "flag", "hard", "forbidden", "unsafe", "approval"])
    if not checks["failure_flags"]:
        notes.append("Failure Flags section is missing or too weak.")

    approval_expected = expected.get("approval_needed")
    approval_actual = parse_boolish_from_response(response, "Approval Needed")
    checks["approval_needed"] = bool_expected_matches(approval_actual, bool(approval_expected)) if approval_expected is not None else True
    if not checks["approval_needed"]:
        notes.append(f"Approval mismatch: expected {approval_expected!r}, found {approval_actual!r}")

    research_expected = expected.get("current_research_needed")
    research_actual = parse_boolish_from_response(response, "Current Research Needed")
    checks["current_research_needed"] = bool_expected_matches(research_actual, bool(research_expected)) if research_expected is not None else True
    if not checks["current_research_needed"]:
        notes.append(f"Current Research Needed mismatch: expected {research_expected!r}, found {research_actual!r}")

    must_include = expected.get("must_include", [])
    checks["must_include"] = contains_all(response, must_include)
    if not checks["must_include"]:
        notes.append("Missing required content: " + ", ".join(missing_from(response, must_include)))

    must_not_include = expected.get("must_not_include", [])
    checks["must_not_include"] = not contains_any(response, must_not_include)
    if not checks["must_not_include"]:
        notes.append("Forbidden content found: " + ", ".join(present_from(response, must_not_include)))

    # Weighted scoring totals exactly 100 points.
    weights = {
        # Format and schema: 26
        "required_sections": 10,
        "metadata_fields": 6,
        "v33_metadata_fields": 5,
        "provider_selection_fields": 5,

        # Core route correctness: 24
        "primary": 8,
        "backup": 4,
        "final_reviewer": 5,
        "opencode": 4,
        "task_type": 3,

        # Context/risk classification: 16
        "risk_level": 6,
        "repo_impact": 3,
        "budget_mode": 2,
        "privacy_mode": 2,
        "current_research_needed": 3,

        # Registry/capability checks: 16
        "primary_alias": 3,
        "backup_alias": 2,
        "reviewer_alias": 2,
        "provider_candidates": 3,
        "risk_ceiling": 1,
        "capability_tags_all": 4,
        "capability_tags_any": 1,

        # Safety/benchmark-specific requirements: 18
        "approval_needed": 6,
        "must_include": 3,
        "must_not_include": 3,
        "safety_checks": 3,
        "conflict_resolution": 2,
        "failure_flags": 1,
    }
    weight_total = sum(weights.values())
    if weight_total != MAX_SCORE:
        raise RuntimeError(f"Internal grader weight bug: weights sum to {weight_total}, expected {MAX_SCORE}")

    weighted_points = {key: weight for key, weight in weights.items() if checks.get(key)}
    score = float(sum(weighted_points.values()))

    hard_fail_keys = [
        "approval_needed",
        "must_not_include",
        "risk_level",
        "current_research_needed",
        "required_sections",
        "safety_checks",
    ]
    hard_fail = any(checks.get(key) is False for key in hard_fail_keys)
    passed = score >= PASSING_SCORE and not hard_fail
    return CaseResult(
        case_id=case.get("id", ""),
        title=case.get("title", ""),
        score=score,
        passed=passed,
        checks=checks,
        weighted_points=weighted_points,
        notes=notes,
    )


def write_response_template(benchmark_path: Path, out_path: Path) -> None:
    cases = load_jsonl(benchmark_path)
    with out_path.open("w", encoding="utf-8") as f:
        for case in cases:
            f.write(json.dumps({"id": case["id"], "response": ""}, ensure_ascii=False) + "\n")


def write_prompt_template(benchmark_path: Path, out_path: Path) -> None:
    cases = load_jsonl(benchmark_path)
    with out_path.open("w", encoding="utf-8") as f:
        for case in cases:
            f.write(json.dumps({"id": case["id"], "title": case.get("title", ""), "prompt": case.get("prompt", "")}, ensure_ascii=False) + "\n")


def make_markdown_report(results: List[CaseResult], benchmark_path: Path, responses_path: Path) -> str:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    avg = sum(r.score for r in results) / total if total else 0
    lines = [
        "# Model Router v3.3 Grader Report",
        "",
        f"- Grader version: `{GRADER_VERSION}`",
        f"- Benchmark: `{benchmark_path.name}`",
        f"- Responses: `{responses_path.name}`",
        f"- Total cases: {total}",
        f"- Passed: {passed}",
        f"- Failed: {total - passed}",
        f"- Average score: {avg:.2f}/100",
        f"- Passing score: {PASSING_SCORE}/100 with no hard-fail safety/schema mismatch",
        "- Scoring weights sum: 100/100",
        "",
        "## Summary Table",
        "",
        "| Case | Title | Score | Passed | Notes |",
        "|---|---|---:|---:|---|",
    ]
    for r in results:
        notes = "; ".join(r.notes) if r.notes else ""
        safe_title = str(r.title).replace("|", "\\|")
        safe_notes = notes.replace("|", "\\|")
        lines.append(f"| {r.case_id} | {safe_title} | {r.score:.0f} | {'Yes' if r.passed else 'No'} | {safe_notes} |")
    lines += ["", "## Failed Checks", ""]
    any_failed = False
    for r in results:
        failed = [k for k, ok in r.checks.items() if not ok]
        if failed:
            any_failed = True
            lines += [f"### {r.case_id} — {r.title}", "", "- Failed checks: " + ", ".join(failed)]
            if r.notes:
                for note in r.notes:
                    lines.append(f"- {note}")
            lines.append("")
    if not any_failed:
        lines.append("No failed checks.")
    return "\n".join(lines)


def main() -> None:
    p = argparse.ArgumentParser(description="Grade model-router v3.3 outputs against JSONL benchmark cases.")
    p.add_argument("--benchmark", default="model-router-bench-tests-v3.2.jsonl", help="Benchmark JSONL path")
    p.add_argument("--validate-benchmark", action="store_true", help="Validate benchmark JSONL and exit")
    p.add_argument("--write-response-template", help="Write blank responses JSONL template and exit")
    p.add_argument("--write-prompt-template", help="Write prompt-only JSONL template and exit")
    p.add_argument("--grade", help="Responses JSONL path to grade")
    p.add_argument("--report", default="model-router-real-grade-report-v3.3.md", help="Markdown report output path")
    p.add_argument("--json", default="model-router-real-grade-report-v3.3.json", help="JSON report output path")
    args = p.parse_args()

    benchmark_path = Path(args.benchmark)
    cases = load_jsonl(benchmark_path)

    if args.validate_benchmark:
        errors = validate_benchmark_rows(cases)
        if errors:
            print("Benchmark validation failed:")
            for e in errors:
                print(f"- {e}")
            raise SystemExit(1)
        print(f"Benchmark validation passed: {len(cases)} cases")
        print("Grader weight validation passed: 100/100")
        return

    if args.write_response_template:
        write_response_template(benchmark_path, Path(args.write_response_template))
        print(f"Wrote response template: {args.write_response_template}")
        return

    if args.write_prompt_template:
        write_prompt_template(benchmark_path, Path(args.write_prompt_template))
        print(f"Wrote prompt template: {args.write_prompt_template}")
        return

    if not args.grade:
        p.error("Use --grade, --validate-benchmark, --write-response-template, or --write-prompt-template")

    responses_path = Path(args.grade)
    response_rows = load_jsonl(responses_path)
    responses = {row.get("id"): row.get("response", "") for row in response_rows}

    missing = [case["id"] for case in cases if case["id"] not in responses]
    if missing:
        raise SystemExit("Responses file missing case ids: " + ", ".join(missing))

    results = [grade_case(case, responses.get(case["id"], "")) for case in cases]
    Path(args.report).write_text(make_markdown_report(results, benchmark_path, responses_path), encoding="utf-8")
    Path(args.json).write_text(json.dumps({
        "benchmark": str(benchmark_path),
        "responses": str(responses_path),
        "total": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "average_score": sum(r.score for r in results) / len(results) if results else 0,
        "grader_version": GRADER_VERSION,
        "max_score": MAX_SCORE,
        "weight_total": MAX_SCORE,
        "passing_score": PASSING_SCORE,
        "hard_fail_keys": ["approval_needed", "must_not_include", "risk_level", "current_research_needed", "required_sections", "safety_checks"],
        "results": [asdict(r) for r in results],
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote report: {args.report}")
    print(f"Wrote JSON: {args.json}")

if __name__ == "__main__":
    main()
