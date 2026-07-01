#!/usr/bin/env python3
"""
collect_model_router_benchmark_v3_2.py

Manual benchmark-collection automation for model-router-fixed-v3.2.md.

This script does not call an LLM or opencode by itself. It automates the
manual workflow around the router:
  1. validates the benchmark and required files,
  2. exports copy/paste-ready prompt files,
  3. tracks missing/completed benchmark responses,
  4. collects pasted router outputs into JSONL,
  5. invokes model_router_grader_v3_2.py when ready.

Expected response JSONL schema:
  {"id": "MRV3-001", "response": "full router output here"}

Common commands:
  python collect_model_router_benchmark_v3_2.py validate
  python collect_model_router_benchmark_v3_2.py export-prompts
  python collect_model_router_benchmark_v3_2.py status
  python collect_model_router_benchmark_v3_2.py collect --case-id MRV3-001
  python collect_model_router_benchmark_v3_2.py collect-next
  python collect_model_router_benchmark_v3_2.py grade
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

DEFAULT_ROUTER = "model-router-fixed-v3.2.md"
DEFAULT_BENCHMARK = "model-router-bench-tests-v3.2.jsonl"
DEFAULT_GRADER = "model_router_grader_v3_2.py"
DEFAULT_RESPONSES = "model-router-real-responses-v3.2.jsonl"
DEFAULT_PROMPTS_DIR = "model-router-manual-prompts-v3.2"
DEFAULT_REPORT = "model-router-real-grade-report-v3.2.md"
DEFAULT_JSON_REPORT = "model-router-real-grade-report-v3.2.json"
END_MARKER = "<<<END>>>"


@dataclass(frozen=True)
class Paths:
    router: Path
    benchmark: Path
    grader: Path
    responses: Path
    prompts_dir: Path
    report: Path
    json_report: Path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSONL at {path}:{line_no}: {exc}") from exc
    return rows


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def require_files(paths: Paths, need_responses: bool = False) -> List[str]:
    required = [paths.router, paths.benchmark, paths.grader]
    if need_responses:
        required.append(paths.responses)
    return [str(p) for p in required if not p.exists()]


def load_benchmark(path: Path) -> List[Dict[str, Any]]:
    cases = load_jsonl(path)
    if not cases:
        raise SystemExit(f"Benchmark is empty or missing: {path}")
    ids: set[str] = set()
    for idx, case in enumerate(cases, 1):
        cid = case.get("id")
        if not cid:
            raise SystemExit(f"Benchmark row {idx} is missing id")
        if cid in ids:
            raise SystemExit(f"Benchmark has duplicate id: {cid}")
        ids.add(cid)
        if not case.get("prompt"):
            raise SystemExit(f"Benchmark case {cid} is missing prompt")
    return cases


def load_responses(path: Path) -> Dict[str, str]:
    rows = load_jsonl(path)
    responses: Dict[str, str] = {}
    for row in rows:
        cid = row.get("id")
        if cid:
            responses[str(cid)] = str(row.get("response", ""))
    return responses


def save_responses(path: Path, cases: List[Dict[str, Any]], responses: Dict[str, str]) -> None:
    rows = [{"id": case["id"], "response": responses.get(case["id"], "")} for case in cases]
    write_jsonl(path, rows)


def slug_case_id(case_id: str) -> str:
    return case_id.replace("/", "-").replace("\\", "-").strip()


def build_prompt(router_text: str, case: Dict[str, Any]) -> str:
    title = case.get("title", "Untitled")
    prompt = case.get("prompt", "")
    cid = case.get("id", "UNKNOWN")
    return f"""# Model Router Manual Benchmark Prompt — {cid}: {title}

## Operator Instructions

Paste the complete content of this file into the model-router context that uses `model-router-fixed-v3.2.md`, or paste the router prompt and task together into the same LLM session.

The model-router must route the task. It must not perform the implementation, research, or code edit. Return only the router's required output.

## Router Prompt Under Test

{router_text.rstrip()}

---

## Benchmark Case

- Case ID: `{cid}`
- Title: `{title}`

### Task to Route

{prompt}

## Required Response Handling

Return the router answer only. Do not add commentary outside the router output.
"""


def export_prompts(paths: Paths, include_router: bool = True, overwrite: bool = True) -> Tuple[int, Path]:
    cases = load_benchmark(paths.benchmark)
    router_text = read_text(paths.router) if include_router else "[Router prompt omitted. Use model-router-fixed-v3.2.md as the system/developer prompt.]"
    if overwrite and paths.prompts_dir.exists():
        shutil.rmtree(paths.prompts_dir)
    paths.prompts_dir.mkdir(parents=True, exist_ok=True)

    index_lines = [
        "# Model Router v3.2 Manual Benchmark Prompt Index",
        "",
        f"- Router: `{paths.router.name}`",
        f"- Benchmark: `{paths.benchmark.name}`",
        f"- Total cases: {len(cases)}",
        "",
        "## Usage",
        "",
        "1. Open each prompt file below.",
        "2. Paste it into the router session.",
        "3. Copy the router output.",
        "4. Run `collect-next` or `collect --case-id <ID>` and paste the output until `<<<END>>>`.",
        "5. Run `grade` after all cases are complete.",
        "",
        "## Cases",
        "",
        "| Case | Title | Prompt file |",
        "|---|---|---|",
    ]

    for case in cases:
        cid = case["id"]
        filename = f"{slug_case_id(cid)}.md"
        prompt_path = paths.prompts_dir / filename
        write_text(prompt_path, build_prompt(router_text, case))
        title = str(case.get("title", ""))
        index_lines.append(f"| {cid} | {title} | `{filename}` |")

    index_path = paths.prompts_dir / "INDEX.md"
    write_text(index_path, "\n".join(index_lines) + "\n")
    return len(cases), index_path


def status(paths: Paths) -> Tuple[int, int, List[str]]:
    cases = load_benchmark(paths.benchmark)
    responses = load_responses(paths.responses)
    missing = [case["id"] for case in cases if not responses.get(case["id"], "").strip()]
    complete = len(cases) - len(missing)
    return complete, len(cases), missing


def print_status(paths: Paths) -> None:
    complete, total, missing = status(paths)
    pct = (complete / total * 100) if total else 0
    print(f"Completed: {complete}/{total} ({pct:.1f}%)")
    if missing:
        print("Next missing case:", missing[0])
        print("Missing ids:", ", ".join(missing))
    else:
        print("All benchmark responses are filled. Ready to grade.")


def find_case(cases: List[Dict[str, Any]], case_id: str) -> Dict[str, Any]:
    for case in cases:
        if case.get("id") == case_id:
            return case
    raise SystemExit(f"No benchmark case found for id: {case_id}")


def first_missing_case(cases: List[Dict[str, Any]], responses: Dict[str, str]) -> Optional[Dict[str, Any]]:
    for case in cases:
        if not responses.get(case["id"], "").strip():
            return case
    return None


def collect_response(paths: Paths, case_id: Optional[str], replace: bool = False) -> None:
    cases = load_benchmark(paths.benchmark)
    responses = load_responses(paths.responses)
    if not paths.responses.exists():
        save_responses(paths.responses, cases, responses)

    case = find_case(cases, case_id) if case_id else first_missing_case(cases, responses)
    if not case:
        print("All responses are already collected. Nothing to collect.")
        return

    cid = case["id"]
    existing = responses.get(cid, "")
    if existing.strip() and not replace:
        raise SystemExit(f"Case {cid} already has a response. Re-run with --replace to overwrite.")

    prompt_file = paths.prompts_dir / f"{slug_case_id(cid)}.md"
    print(f"Collecting response for {cid}: {case.get('title', '')}")
    if prompt_file.exists():
        print(f"Prompt file: {prompt_file}")
    else:
        print("Prompt file has not been exported yet. Run: export-prompts")
    print("")
    print(f"Paste the full router output below. Finish with a line containing only {END_MARKER}")
    print("-" * 72)

    lines: List[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == END_MARKER:
            break
        lines.append(line)

    response = "\n".join(lines).strip()
    if not response:
        raise SystemExit("No response captured. Response file was not changed.")

    responses[cid] = response
    save_responses(paths.responses, cases, responses)
    print(f"Saved response for {cid} to {paths.responses}")
    print_status(paths)


def run_grader(paths: Paths) -> None:
    missing_files = require_files(paths, need_responses=True)
    if missing_files:
        raise SystemExit("Missing required files:\n- " + "\n- ".join(missing_files))
    complete, total, missing = status(paths)
    if missing:
        print(f"Warning: only {complete}/{total} responses are filled.")
        print("The grader can run, but blank/missing responses will fail.")
        print("Missing ids:", ", ".join(missing))

    cmd = [
        sys.executable,
        str(paths.grader),
        "--grade",
        str(paths.responses),
        "--benchmark",
        str(paths.benchmark),
        "--report",
        str(paths.report),
        "--json",
        str(paths.json_report),
    ]
    print("Running grader:")
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)


def init_responses(paths: Paths, overwrite: bool = False) -> None:
    cases = load_benchmark(paths.benchmark)
    if paths.responses.exists() and not overwrite:
        print(f"Responses file already exists: {paths.responses}")
        return
    save_responses(paths.responses, cases, {})
    print(f"Initialized blank responses file: {paths.responses}")


def validate(paths: Paths) -> None:
    missing_files = require_files(paths)
    if missing_files:
        raise SystemExit("Missing required files:\n- " + "\n- ".join(missing_files))
    cases = load_benchmark(paths.benchmark)
    print(f"Found router: {paths.router}")
    print(f"Found benchmark: {paths.benchmark} ({len(cases)} cases)")
    print(f"Found grader: {paths.grader}")
    if paths.responses.exists():
        complete, total, missing = status(paths)
        print(f"Found responses: {paths.responses} ({complete}/{total} complete)")
        if missing:
            print("Next missing case:", missing[0])
    else:
        print(f"Responses file not created yet: {paths.responses}")
    print("Validation passed.")


def make_paths(args: argparse.Namespace) -> Paths:
    base = Path(args.workdir).resolve()
    return Paths(
        router=(base / args.router).resolve(),
        benchmark=(base / args.benchmark).resolve(),
        grader=(base / args.grader).resolve(),
        responses=(base / args.responses).resolve(),
        prompts_dir=(base / args.prompts_dir).resolve(),
        report=(base / args.report).resolve(),
        json_report=(base / args.json_report).resolve(),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manual model-router v3.2 benchmark collection helper")
    parser.add_argument("command", choices=["validate", "init", "export-prompts", "status", "collect", "collect-next", "grade", "all"], help="Action to perform")
    parser.add_argument("--workdir", default=".", help="Directory containing router, benchmark, and grader files")
    parser.add_argument("--router", default=DEFAULT_ROUTER, help="Router prompt file")
    parser.add_argument("--benchmark", default=DEFAULT_BENCHMARK, help="Benchmark JSONL file")
    parser.add_argument("--grader", default=DEFAULT_GRADER, help="Grader script")
    parser.add_argument("--responses", default=DEFAULT_RESPONSES, help="Responses JSONL file")
    parser.add_argument("--prompts-dir", default=DEFAULT_PROMPTS_DIR, help="Directory for exported prompt files")
    parser.add_argument("--report", default=DEFAULT_REPORT, help="Markdown grade report output")
    parser.add_argument("--json-report", default=DEFAULT_JSON_REPORT, help="JSON grade report output")
    parser.add_argument("--case-id", help="Benchmark case id for collect")
    parser.add_argument("--replace", action="store_true", help="Overwrite an existing response for collect")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite prompt directory or response template")
    parser.add_argument("--no-router-in-prompts", action="store_true", help="Do not embed the router prompt inside exported prompt files")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    paths = make_paths(args)

    if args.command == "validate":
        validate(paths)
    elif args.command == "init":
        init_responses(paths, overwrite=args.overwrite)
    elif args.command == "export-prompts":
        count, index = export_prompts(paths, include_router=not args.no_router_in_prompts, overwrite=args.overwrite or True)
        print(f"Exported {count} prompt files.")
        print(f"Index: {index}")
    elif args.command == "status":
        print_status(paths)
    elif args.command == "collect":
        if not args.case_id:
            raise SystemExit("collect requires --case-id. Use collect-next for the first missing case.")
        collect_response(paths, args.case_id, replace=args.replace)
    elif args.command == "collect-next":
        collect_response(paths, None, replace=args.replace)
    elif args.command == "grade":
        run_grader(paths)
    elif args.command == "all":
        validate(paths)
        init_responses(paths, overwrite=False)
        count, index = export_prompts(paths, include_router=not args.no_router_in_prompts, overwrite=True)
        print(f"Exported {count} prompt files.")
        print(f"Index: {index}")
        print_status(paths)
    else:
        parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
