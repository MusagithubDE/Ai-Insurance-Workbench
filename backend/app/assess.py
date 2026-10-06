"""The single assessment-creation flow, shared by POST /assessments and the
evaluation suite (app/evaluation.py) so both exercise exactly the same code
path -- an evaluation is only honest if it measures what the real endpoint
actually does, not a parallel reimplementation that can drift from it.
"""
from __future__ import annotations

import json
import sqlite3
import time
from datetime import datetime, timezone
from uuid import uuid4

from app import db
from app.api_models import AssessmentResponse, to_evidence_items
from app.decisions import determine_next_action
from app.events import build_events
from app.model_adapter import ModelAdapter
from app.model_tasks import SummaryResult, generate_draft_messages, generate_summary, should_draft_messages
from app.pipeline import run_assessment


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def perform_assessment(
    conn: sqlite3.Connection,
    claim_id: str,
    user_role: str,
    model_adapter: ModelAdapter,
    persist: bool = True,
) -> tuple[AssessmentResponse, float, SummaryResult | None]:
    """Runs the fixed workflow (tools -> checks -> status) plus the model's
    summary/draft jobs, and optionally persists the run for SSE replay and
    the claims queue. Returns (response, wall_clock_seconds, summary_result)
    -- summary_result carries pre-citation-stripping diagnostics the public
    AssessmentResponse doesn't expose, for the evaluation suite's use."""
    start = time.perf_counter()
    result = run_assessment(conn, claim_id, user_role=user_role)

    run_id = str(uuid4())
    created_at = now_iso()
    next_action = determine_next_action(result)
    evidence_items = to_evidence_items(result.evidence)

    summary_result: SummaryResult | None = None
    draft_messages = None
    if result.status != "INCOMPLETE":
        summary_result = generate_summary(model_adapter, evidence_items, result.checks, result.status)
        if should_draft_messages(result.checks):
            draft_messages = generate_draft_messages(model_adapter, evidence_items, result.checks)

    response = AssessmentResponse(
        run_id=run_id,
        claim_id=claim_id,
        user_role=user_role,
        status=result.status,
        checks=result.checks,
        evidence=evidence_items,
        summary=summary_result.text if summary_result else None,
        summary_status=summary_result.status if summary_result else "not_generated",
        draft_messages=draft_messages,
        next_action=next_action,
        trace=result.trace,
        failed_tool=result.failed_tool,
        created_at=created_at,
    )

    elapsed_seconds = time.perf_counter() - start

    if persist:
        events = build_events(result)
        db.save_run(
            conn, run_id, claim_id, user_role, result.status,
            created_at, response.model_dump_json(), json.dumps(events),
        )

    return response, elapsed_seconds, summary_result
