"""Builds the ordered event list the SSE stream replays so the UI can
animate the checklist as it would have appeared live: one event per tool
call, then one event per check. Never carries the model's private
reasoning -- only tool/check facts."""
from app.schemas import AssessmentResult


def build_events(result: AssessmentResult) -> list[dict]:
    events: list[dict] = []
    seq = 0

    for t in result.trace:
        seq += 1
        events.append({
            "seq": seq,
            "kind": "tool_call",
            "name": t.tool_name,
            "status": "error" if t.error else "ok",
            "detail": t.error or t.result_summary,
            "duration_ms": t.duration_ms,
        })

    for c in result.checks:
        seq += 1
        events.append({
            "seq": seq,
            "kind": "check",
            "name": c.check_id,
            "label": c.label,
            "status": c.status,
            "detail": c.reason,
            "duration_ms": None,
        })

    return events
