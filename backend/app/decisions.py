"""Deterministic, code-only decision about what the assessor should do next.
Never an approval/rejection -- just a pointer to the right next step."""
from app.schemas import AssessmentResult

DOCUMENT_RELATED_CHECKS = {"required_documents", "police_report_present"}


def determine_next_action(result: AssessmentResult) -> str:
    if result.status == "INCOMPLETE":
        return (
            f"Re-run the assessment -- the {result.failed_tool} tool did not respond. "
            "The evidence gathered so far is shown below."
        )
    if result.status == "READY_FOR_HUMAN_REVIEW":
        return "All automated checks passed. This claim is ready for a human reviewer to sign off."

    flagged = [c for c in result.checks if c.status in ("fail", "unknown")]
    labels = [c.label for c in flagged]
    if any(c.check_id in DOCUMENT_RELATED_CHECKS for c in flagged):
        return f"Request missing information from the customer before proceeding: {', '.join(labels)}."
    return f"Resolve the following before proceeding: {', '.join(labels)}."
