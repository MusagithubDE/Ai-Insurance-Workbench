"""Pydantic models for the HTTP API surface (requests/responses). Domain
schemas (CheckResult, TraceEntry, AssessmentResult) live in app.schemas;
these models shape that domain data for the frontend."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import AssessmentStatus, CheckResult, TraceEntry, UserRole

EvidenceCategory = Literal["claim", "customer", "policy", "policy_wording", "document", "billing", "claims_history"]
SummaryStatus = Literal["not_generated", "ready", "unavailable"]
FeedbackVerdict = Literal["correct", "incorrect"]

# Fixture-authoring metadata (which scenario this is, what the expected
# outcome is, which tool to simulate failing) -- real evidence for the
# evaluation suite, never for an assessor or the model to see.
_INTERNAL_CLAIM_FIELDS = {"scenario", "expected_status", "simulate_tool_failure"}


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str = Field(min_length=1, max_length=50)
    user_role: UserRole = "assessor"


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evidence_id: str
    category: EvidenceCategory
    title: str
    detail: dict


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str
    claim_id: str
    user_role: UserRole
    status: AssessmentStatus
    checks: list[CheckResult]
    evidence: list[EvidenceItem]
    summary: str | None = None
    summary_status: SummaryStatus = "not_generated"
    draft_messages: dict | None = None
    next_action: str
    trace: list[TraceEntry]
    failed_tool: str | None = None
    created_at: str


class ClaimQueueItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    customer_name: str
    incident_date: str
    vehicle_registration: str
    claim_type: str
    age_days: int
    last_run_status: AssessmentStatus | None = None
    last_run_id: str | None = None


class ClaimsQueueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claims: list[ClaimQueueItem]
    data_mode: Literal["synthetic"] = "synthetic"


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str = Field(min_length=1)
    check_id: str = Field(min_length=1, max_length=100)
    verdict: FeedbackVerdict
    note: str | None = Field(default=None, max_length=2000)


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    feedback_id: str
    run_id: str
    check_id: str
    verdict: FeedbackVerdict
    note: str | None
    created_at: str


class ScenarioResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    scenario: str
    expected_status: AssessmentStatus
    actual_status: AssessmentStatus
    passed: bool
    run_time_ms: float
    tool_call_count: int


class EvaluationMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")
    accuracy: float
    citation_validity_rate: float | None
    missed_conflicts: int
    false_review_required_count: int
    avg_run_time_ms: float
    avg_tool_calls: float


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenarios: list[ScenarioResult]
    metrics: EvaluationMetrics
    model_tag: str
    git_commit: str
    dataset_version: str
    run_at: str


def to_evidence_items(evidence: dict) -> list[EvidenceItem]:
    items: list[EvidenceItem] = []

    if "claim" in evidence:
        c = evidence["claim"]
        detail = {k: v for k, v in c.items() if k not in _INTERNAL_CLAIM_FIELDS}
        items.append(EvidenceItem(evidence_id=c["claim_id"], category="claim", title=f"Claim {c['claim_id']}", detail=detail))

    if "customer" in evidence:
        cu = evidence["customer"]
        items.append(EvidenceItem(evidence_id=cu["customer_id"], category="customer", title=cu["name"], detail=cu))

    if "policy" in evidence:
        p = evidence["policy"]
        items.append(EvidenceItem(evidence_id=p["policy_id"], category="policy", title=f"Policy {p['policy_id']}", detail=p))

    if evidence.get("wording"):
        w = evidence["wording"]
        items.append(EvidenceItem(
            evidence_id=w["doc_id"], category="policy_wording",
            title=f"{w['product']} ({w['version']})", detail=w,
        ))

    for d in evidence.get("documents", []):
        items.append(EvidenceItem(evidence_id=d["doc_id"], category="document", title=d.get("title", d["doc_id"]), detail=d))

    if evidence.get("billing"):
        b = evidence["billing"]
        items.append(EvidenceItem(evidence_id=b["bill_id"], category="billing", title=f"Billing {b['month']}", detail=b))

    for h in evidence.get("history", []):
        items.append(EvidenceItem(
            evidence_id=h["history_id"], category="claims_history",
            title=f"Prior claim {h['prior_claim_id']}", detail=h,
        ))

    return items
