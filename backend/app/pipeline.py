"""Fixed evidence-gathering workflow: calls the allow-listed tools in a set
order, runs the deterministic checks, and derives a status. No model call
happens here -- this module is the "code decides" half of the system.
"""
import sqlite3

from app.checks import derive_status, run_all_checks
from app.schemas import AssessmentResult, ToolError
from app.tools import MAX_TOOL_CALLS, ToolRegistry


def run_assessment(conn: sqlite3.Connection, claim_id: str, user_role: str = "assessor", max_calls: int = MAX_TOOL_CALLS) -> AssessmentResult:
    registry = ToolRegistry(conn, max_calls=max_calls)
    evidence: dict = {}

    try:
        claim = registry.call("get_claim", claim_id=claim_id)
        evidence["claim"] = claim
        registry.simulate_failure = claim.get("simulate_tool_failure")

        evidence["customer"] = registry.call("get_customer", customer_id=claim["customer_id"])
        evidence["policy"] = registry.call("get_policy", policy_id=claim["policy_id"])
        evidence["wording"] = registry.call(
            "get_policy_wording", policy_id=claim["policy_id"], as_of_date=claim["incident_date"]
        )
        evidence["documents"] = registry.call("get_documents", claim_id=claim_id, user_role=user_role)
        month = claim["incident_date"][:7]
        evidence["billing"] = registry.call("get_billing", policy_id=claim["policy_id"], month=month)
        evidence["history"] = registry.call("get_claims_history", vehicle_id=claim["vehicle_id"])
    except ToolError as exc:
        return AssessmentResult(
            claim_id=claim_id,
            status="INCOMPLETE",
            checks=[],
            evidence=evidence,
            trace=registry.trace,
            failed_tool=exc.tool_name,
        )

    checks = run_all_checks(evidence)
    status = derive_status(checks)
    return AssessmentResult(
        claim_id=claim_id,
        status=status,
        checks=checks,
        evidence=evidence,
        trace=registry.trace,
        failed_tool=None,
    )
