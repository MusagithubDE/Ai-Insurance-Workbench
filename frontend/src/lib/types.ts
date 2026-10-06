// Mirrors backend/app/schemas.py and backend/app/api_models.py.
// Keep in sync with the Pydantic models -- this is the typed contract
// between the FastAPI backend and the UI.

export type CheckStatus = "pass" | "fail" | "unknown";
export type AssessmentStatus = "READY_FOR_HUMAN_REVIEW" | "REVIEW_REQUIRED" | "INCOMPLETE";
export type UserRole = "assessor" | "team_lead";
export type SummaryStatus = "not_generated" | "ready" | "unavailable";
export type EvidenceCategory =
  | "claim"
  | "customer"
  | "policy"
  | "policy_wording"
  | "document"
  | "billing"
  | "claims_history";

export interface CheckResult {
  check_id: string;
  label: string;
  status: CheckStatus;
  reason: string;
  evidence_ids: string[];
}

export interface TraceEntry {
  tool_name: string;
  args: Record<string, unknown>;
  duration_ms: number;
  result_summary: string;
  error: string | null;
}

export interface EvidenceItem {
  evidence_id: string;
  category: EvidenceCategory;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail: Record<string, any>;
}

export interface DraftMessages {
  sms: string;
  email_subject: string;
  email_body: string;
}

export interface AssessmentResponse {
  run_id: string;
  claim_id: string;
  user_role: UserRole;
  status: AssessmentStatus;
  checks: CheckResult[];
  evidence: EvidenceItem[];
  summary: string | null;
  summary_status: SummaryStatus;
  draft_messages: DraftMessages | null;
  next_action: string;
  trace: TraceEntry[];
  failed_tool: string | null;
  created_at: string;
}

export interface ClaimQueueItem {
  claim_id: string;
  customer_name: string;
  incident_date: string;
  vehicle_registration: string;
  claim_type: string;
  age_days: number;
  last_run_status: AssessmentStatus | null;
  last_run_id: string | null;
}

export interface ClaimsQueueResponse {
  claims: ClaimQueueItem[];
  data_mode: "synthetic";
}

export interface HealthResponse {
  status: string;
  data_mode: string;
}

export type SseEventKind = "tool_call" | "check";

export interface SseEvent {
  seq: number;
  kind: SseEventKind;
  name: string;
  label?: string;
  status: string;
  detail: string;
  duration_ms: number | null;
}

export type FeedbackVerdict = "correct" | "incorrect";

export interface FeedbackResponse {
  feedback_id: string;
  run_id: string;
  check_id: string;
  verdict: FeedbackVerdict;
  note: string | null;
  created_at: string;
}

export interface ScenarioResult {
  claim_id: string;
  scenario: string;
  expected_status: AssessmentStatus;
  actual_status: AssessmentStatus;
  passed: boolean;
  run_time_ms: number;
  tool_call_count: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  citation_validity_rate: number | null;
  missed_conflicts: number;
  false_review_required_count: number;
  avg_run_time_ms: number;
  avg_tool_calls: number;
}

export interface EvaluationResponse {
  scenarios: ScenarioResult[];
  metrics: EvaluationMetrics;
  model_tag: string;
  git_commit: string;
  dataset_version: string;
  run_at: string;
}
