import asyncio
import json
from contextlib import asynccontextmanager, closing
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import db
from app.api_models import (
    AssessmentRequest,
    AssessmentResponse,
    ClaimsQueueResponse,
    EvaluationResponse,
    FeedbackRequest,
    FeedbackResponse,
)
from app.assess import now_iso, perform_assessment
from app.evaluation import run_evaluation_suite
from app.model_adapter import ModelAdapter, get_model_adapter
from app.queries import list_claims_queue

EVENT_STREAM_DELAY_SECONDS = 0.15


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.ensure_seeded()
    yield


app = FastAPI(title="Claims Workbench", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "data_mode": "synthetic"}


@app.get("/claims", response_model=ClaimsQueueResponse)
def get_claims_queue():
    with closing(db.connect()) as conn:
        claims = list_claims_queue(conn)
    return ClaimsQueueResponse(claims=claims)


@app.post("/assessments", response_model=AssessmentResponse)
def create_assessment(request: AssessmentRequest, model_adapter: ModelAdapter = Depends(get_model_adapter)):
    with closing(db.connect()) as conn:
        response, _elapsed, _summary_result = perform_assessment(
            conn, request.claim_id, request.user_role, model_adapter
        )
    return response


@app.post("/feedback", response_model=FeedbackResponse, status_code=201)
def create_feedback(request: FeedbackRequest):
    with closing(db.connect()) as conn:
        if db.get_run(conn, request.run_id) is None:
            raise HTTPException(404, "Run not found.")
        feedback_id = str(uuid4())
        created_at = now_iso()
        db.save_feedback(conn, feedback_id, request.run_id, request.check_id, request.verdict, request.note, created_at)
    return FeedbackResponse(
        feedback_id=feedback_id, run_id=request.run_id, check_id=request.check_id,
        verdict=request.verdict, note=request.note, created_at=created_at,
    )


@app.post("/evaluations/run", response_model=EvaluationResponse)
def run_evaluations(model_adapter: ModelAdapter = Depends(get_model_adapter)):
    with closing(db.connect()) as conn:
        return run_evaluation_suite(conn, model_adapter)


@app.get("/assessments/{run_id}/events")
async def stream_assessment_events(run_id: str):
    with closing(db.connect()) as conn:
        row = db.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "Run not found.")

    events = json.loads(row["events_json"])
    status = row["status"]

    async def event_stream():
        for event in events:
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(EVENT_STREAM_DELAY_SECONDS)
        yield f"event: done\ndata: {json.dumps({'status': status})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    with closing(db.connect()) as conn:
        row = db.get_run(conn, run_id)
    if row is None:
        raise HTTPException(404, "Run not found.")
    return json.loads(row["result_json"])
