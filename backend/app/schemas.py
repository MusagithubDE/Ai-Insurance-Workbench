"""Shared Pydantic models: check results, tool trace entries, and tool argument schemas."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CheckStatus = Literal["pass", "fail", "unknown"]
AssessmentStatus = Literal["READY_FOR_HUMAN_REVIEW", "REVIEW_REQUIRED", "INCOMPLETE"]
UserRole = Literal["assessor", "team_lead"]


class CheckResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    check_id: str
    label: str
    status: CheckStatus
    reason: str
    evidence_ids: list[str] = Field(default_factory=list)


class TraceEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tool_name: str
    args: dict
    duration_ms: float
    result_summary: str
    error: str | None = None


class AssessmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    status: AssessmentStatus
    checks: list[CheckResult] = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)
    trace: list[TraceEntry] = Field(default_factory=list)
    failed_tool: str | None = None


class ToolError(Exception):
    def __init__(self, tool_name: str, message: str):
        self.tool_name = tool_name
        self.message = message
        super().__init__(message)


# --- Tool argument schemas (validated allow-list inputs) -----------------

class GetCustomerArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str = Field(min_length=1, max_length=50)


class GetPolicyArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_id: str = Field(min_length=1, max_length=50)


class GetPolicyWordingArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_id: str = Field(min_length=1, max_length=50)
    as_of_date: str = Field(min_length=10, max_length=10)


class GetClaimArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str = Field(min_length=1, max_length=50)


class GetDocumentsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str = Field(min_length=1, max_length=50)
    user_role: UserRole = "assessor"


class GetBillingArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_id: str = Field(min_length=1, max_length=50)
    month: str = Field(min_length=7, max_length=7)


class GetClaimsHistoryArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: str = Field(min_length=1, max_length=50)
