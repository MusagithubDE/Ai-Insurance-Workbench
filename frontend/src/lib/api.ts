import type {
  AssessmentResponse,
  ClaimsQueueResponse,
  EvaluationResponse,
  FeedbackResponse,
  FeedbackVerdict,
  HealthResponse,
  SseEvent,
  UserRole,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the Claims Workbench backend. Is it running?", 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      // response body wasn't JSON -- keep the generic message
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getClaimsQueue(): Promise<ClaimsQueueResponse> {
  return request<ClaimsQueueResponse>("/claims");
}

export function createAssessment(claimId: string, userRole: UserRole): Promise<AssessmentResponse> {
  return request<AssessmentResponse>("/assessments", {
    method: "POST",
    body: JSON.stringify({ claim_id: claimId, user_role: userRole }),
  });
}

export function getRun(runId: string): Promise<AssessmentResponse> {
  return request<AssessmentResponse>(`/runs/${runId}`);
}

export function submitFeedback(
  runId: string,
  checkId: string,
  verdict: FeedbackVerdict,
  note?: string
): Promise<FeedbackResponse> {
  return request<FeedbackResponse>("/feedback", {
    method: "POST",
    body: JSON.stringify({ run_id: runId, check_id: checkId, verdict, note: note || null }),
  });
}

/** Runs the full evaluation suite against the live model. Can take ~20-60s. */
export function runEvaluationSuite(): Promise<EvaluationResponse> {
  return request<EvaluationResponse>("/evaluations/run", { method: "POST" });
}

export interface AssessmentEventHandlers {
  onEvent: (event: SseEvent) => void;
  onDone: (status: string) => void;
  onError?: () => void;
}

/** Opens the SSE stream for a run and returns a cleanup function to close it. */
export function streamAssessmentEvents(runId: string, handlers: AssessmentEventHandlers): () => void {
  const source = new EventSource(`${API_BASE_URL}/assessments/${runId}/events`);

  source.onmessage = (ev) => {
    try {
      handlers.onEvent(JSON.parse(ev.data) as SseEvent);
    } catch {
      // ignore malformed event
    }
  };

  source.addEventListener("done", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as { status: string };
      handlers.onDone(data.status);
    } finally {
      source.close();
    }
  });

  source.onerror = () => {
    handlers.onError?.();
    source.close();
  };

  return () => source.close();
}
