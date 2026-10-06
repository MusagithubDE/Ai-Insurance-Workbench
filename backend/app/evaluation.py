"""Runs every synthetic fixture scenario end-to-end through the exact same
`perform_assessment` flow as POST /assessments, compares the actual status
against each fixture's `expected_status`, and reports the metrics shown on
the Evaluations page. Calls the real model adapter -- this is a live,
non-deterministic suite, not a pytest replacement (see tests/ for the
deterministic, mocked coverage).
"""
from __future__ import annotations

import json
import sqlite3
import subprocess
from pathlib import Path

from app import db
from app.api_models import EvaluationMetrics, EvaluationResponse, ScenarioResult
from app.assess import now_iso, perform_assessment
from app.model_adapter import ModelAdapter

DATASET_VERSION = "fixtures-v1"
REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _git_commit() -> str:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT, capture_output=True, text=True, timeout=5,
        )
        commit = completed.stdout.strip()
        return commit if completed.returncode == 0 and commit else "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def _load_scenarios() -> list[tuple[str, str, str]]:
    """Returns (claim_id, scenario_label, expected_status) straight from the
    fixture file -- the ground truth a fixture's author declared, never from
    data the pipeline itself produced."""
    fixtures_dir = db.get_fixtures_dir()
    with open(fixtures_dir / "claims.json", "r", encoding="utf-8") as f:
        claims = json.load(f)
    return [(c["claim_id"], c.get("scenario", c["claim_id"]), c["expected_status"]) for c in claims]


def run_evaluation_suite(conn: sqlite3.Connection, model_adapter: ModelAdapter) -> EvaluationResponse:
    scenarios: list[ScenarioResult] = []
    citation_total = 0
    citation_valid = 0
    missed_conflicts = 0
    false_review_required = 0
    run_times: list[float] = []
    tool_calls: list[int] = []

    for claim_id, scenario_label, expected_status in _load_scenarios():
        response, elapsed, summary_result = perform_assessment(
            conn, claim_id, "assessor", model_adapter, persist=False
        )
        passed = response.status == expected_status

        if expected_status == "REVIEW_REQUIRED" and response.status == "READY_FOR_HUMAN_REVIEW":
            missed_conflicts += 1
        if expected_status == "READY_FOR_HUMAN_REVIEW" and response.status == "REVIEW_REQUIRED":
            false_review_required += 1
        if summary_result:
            citation_total += summary_result.citations_total
            citation_valid += summary_result.citations_valid

        run_times.append(elapsed)
        tool_calls.append(len(response.trace))
        scenarios.append(ScenarioResult(
            claim_id=claim_id,
            scenario=scenario_label,
            expected_status=expected_status,
            actual_status=response.status,
            passed=passed,
            run_time_ms=round(elapsed * 1000, 1),
            tool_call_count=len(response.trace),
        ))

    metrics = EvaluationMetrics(
        accuracy=round(sum(s.passed for s in scenarios) / len(scenarios), 4) if scenarios else 0.0,
        citation_validity_rate=round(citation_valid / citation_total, 4) if citation_total else None,
        missed_conflicts=missed_conflicts,
        false_review_required_count=false_review_required,
        avg_run_time_ms=round(sum(run_times) / len(run_times) * 1000, 1) if run_times else 0.0,
        avg_tool_calls=round(sum(tool_calls) / len(tool_calls), 2) if tool_calls else 0.0,
    )

    return EvaluationResponse(
        scenarios=scenarios,
        metrics=metrics,
        model_tag=getattr(model_adapter, "model", None) or "unknown",
        git_commit=_git_commit(),
        dataset_version=DATASET_VERSION,
        run_at=now_iso(),
    )
