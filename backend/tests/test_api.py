import pytest
from fastapi.testclient import TestClient

import main
from app.model_adapter import get_model_adapter
from tests.conftest import FakeModelAdapter


@pytest.fixture()
def make_client(tmp_path, monkeypatch):
    """Builds a TestClient with a stand-in model adapter, so API tests stay
    fast and deterministic without a real Ollama instance. Pass a custom
    FakeModelAdapter to exercise retry/failure/citation-stripping paths."""
    monkeypatch.setenv("WORKBENCH_DB_PATH", str(tmp_path / "api_test.sqlite3"))

    def _make(adapter=None):
        main.app.dependency_overrides[get_model_adapter] = lambda: adapter if adapter is not None else FakeModelAdapter()
        return TestClient(main.app)

    yield _make
    main.app.dependency_overrides.clear()


@pytest.fixture()
def client(make_client):
    with make_client() as c:
        yield c


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "data_mode": "synthetic"}


def test_claims_queue_lists_all_eight(client):
    response = client.get("/claims")
    assert response.status_code == 200
    body = response.json()
    assert body["data_mode"] == "synthetic"
    assert len(body["claims"]) == 8
    claim = body["claims"][0]
    assert {"claim_id", "customer_name", "incident_date", "vehicle_registration", "age_days"} <= claim.keys()
    assert all(c["last_run_status"] is None for c in body["claims"])


def test_post_assessment_ready_for_review(client):
    response = client.post("/assessments", json={"claim_id": "ACC-3010", "user_role": "assessor"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "READY_FOR_HUMAN_REVIEW"
    assert body["run_id"]
    assert len(body["evidence"]) > 0
    assert len(body["checks"]) == 10
    assert body["summary_status"] == "ready"
    assert body["summary"] == "This is a fake, deterministic summary for testing."
    assert body["draft_messages"] is None  # nothing missing on a clean claim
    assert "ready for a human reviewer" in body["next_action"]


def test_post_assessment_review_required(client):
    response = client.post("/assessments", json={"claim_id": "ACC-2048", "user_role": "assessor"})
    body = response.json()
    assert body["status"] == "REVIEW_REQUIRED"
    assert "Policy in force" in body["next_action"] or "Incident date consistency" in body["next_action"]


def test_post_assessment_incomplete_on_tool_failure(client):
    response = client.post("/assessments", json={"claim_id": "ACC-3016", "user_role": "assessor"})
    body = response.json()
    assert body["status"] == "INCOMPLETE"
    assert body["failed_tool"] == "get_billing"
    assert body["checks"] == []
    categories = {e["category"] for e in body["evidence"]}
    assert "claim" in categories
    assert "billing" not in categories
    assert "get_billing" in body["next_action"]
    # No checks ran, so there's nothing grounded to summarise -- the model is never called.
    assert body["summary_status"] == "not_generated"
    assert body["draft_messages"] is None


def test_post_assessment_review_required_includes_draft_messages(client):
    response = client.post("/assessments", json={"claim_id": "ACC-3014", "user_role": "assessor"})
    body = response.json()
    assert body["status"] == "REVIEW_REQUIRED"  # police report missing
    assert body["summary_status"] == "ready"
    assert body["draft_messages"]["sms"]
    assert body["draft_messages"]["email_subject"]
    assert body["draft_messages"]["email_body"]


def test_post_assessment_summary_unavailable_when_model_fails(make_client):
    with make_client(FakeModelAdapter(fail=True)) as client:
        response = client.post("/assessments", json={"claim_id": "ACC-3010", "user_role": "assessor"})
    body = response.json()
    assert body["summary_status"] == "unavailable"
    assert body["summary"] is None


def test_post_assessment_strips_fabricated_citations(make_client):
    adapter = FakeModelAdapter(summary_text="All good [POL-9999999-DOES-NOT-EXIST] and consistent.")
    with make_client(adapter) as client:
        response = client.post("/assessments", json={"claim_id": "ACC-3010", "user_role": "assessor"})
    body = response.json()
    assert "POL-9999999-DOES-NOT-EXIST" not in body["summary"]
    assert "All good" in body["summary"]


def test_post_assessment_hides_internal_fixture_fields_from_claim_evidence(client):
    """scenario/expected_status/simulate_tool_failure are fixture-authoring
    metadata -- they must never reach the assessor's evidence drawer or the
    model's prompt via the claim evidence item."""
    response = client.post("/assessments", json={"claim_id": "ACC-2048", "user_role": "assessor"})
    body = response.json()
    claim_evidence = next(e for e in body["evidence"] if e["category"] == "claim")
    assert "scenario" not in claim_evidence["detail"]
    assert "expected_status" not in claim_evidence["detail"]
    assert "simulate_tool_failure" not in claim_evidence["detail"]
    assert claim_evidence["detail"]["claim_id"] == "ACC-2048"  # real fields still present


def test_post_assessment_unknown_claim_is_incomplete(client):
    response = client.post("/assessments", json={"claim_id": "ACC-9999", "user_role": "assessor"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INCOMPLETE"
    assert body["failed_tool"] == "get_claim"


def test_post_assessment_rejects_unknown_fields(client):
    response = client.post("/assessments", json={"claim_id": "ACC-3010", "nope": True})
    assert response.status_code == 422


def test_get_run_after_assessment(client):
    created = client.post("/assessments", json={"claim_id": "ACC-3010"}).json()
    response = client.get(f"/runs/{created['run_id']}")
    assert response.status_code == 200
    assert response.json()["status"] == "READY_FOR_HUMAN_REVIEW"


def test_get_run_not_found(client):
    response = client.get("/runs/does-not-exist")
    assert response.status_code == 404


def test_claims_queue_reflects_last_run(client):
    created = client.post("/assessments", json={"claim_id": "ACC-3010"}).json()
    body = client.get("/claims").json()
    row = next(c for c in body["claims"] if c["claim_id"] == "ACC-3010")
    assert row["last_run_status"] == "READY_FOR_HUMAN_REVIEW"
    assert row["last_run_id"] == created["run_id"]


def test_events_stream_replays_tool_calls_and_checks(client, monkeypatch):
    monkeypatch.setattr(main, "EVENT_STREAM_DELAY_SECONDS", 0)
    created = client.post("/assessments", json={"claim_id": "ACC-3010"}).json()
    response = client.get(f"/assessments/{created['run_id']}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    text = response.text
    assert text.count('"kind": "tool_call"') == len(created["trace"])
    assert text.count('"kind": "check"') == len(created["checks"])
    assert "event: done" in text


def test_events_stream_404_for_unknown_run(client, monkeypatch):
    monkeypatch.setattr(main, "EVENT_STREAM_DELAY_SECONDS", 0)
    response = client.get("/assessments/does-not-exist/events")
    assert response.status_code == 404


# --- /feedback ---------------------------------------------------------------

def test_post_feedback_succeeds_for_a_real_run(client):
    created = client.post("/assessments", json={"claim_id": "ACC-2048"}).json()
    check_id = created["checks"][0]["check_id"]

    response = client.post("/feedback", json={
        "run_id": created["run_id"], "check_id": check_id, "verdict": "incorrect", "note": "Looks wrong to me.",
    })

    assert response.status_code == 201
    body = response.json()
    assert body["feedback_id"]
    assert body["run_id"] == created["run_id"]
    assert body["check_id"] == check_id
    assert body["verdict"] == "incorrect"
    assert body["note"] == "Looks wrong to me."


def test_post_feedback_note_is_optional(client):
    created = client.post("/assessments", json={"claim_id": "ACC-3010"}).json()
    response = client.post("/feedback", json={
        "run_id": created["run_id"], "check_id": "policy_in_force", "verdict": "correct",
    })
    assert response.status_code == 201
    assert response.json()["note"] is None


def test_post_feedback_404_for_unknown_run(client):
    response = client.post("/feedback", json={
        "run_id": "does-not-exist", "check_id": "policy_in_force", "verdict": "correct",
    })
    assert response.status_code == 404


def test_post_feedback_rejects_invalid_verdict(client):
    created = client.post("/assessments", json={"claim_id": "ACC-3010"}).json()
    response = client.post("/feedback", json={
        "run_id": created["run_id"], "check_id": "policy_in_force", "verdict": "maybe",
    })
    assert response.status_code == 422


# --- /evaluations/run ---------------------------------------------------------

def test_post_evaluations_run_covers_all_eight_scenarios(client):
    response = client.post("/evaluations/run")
    assert response.status_code == 200
    body = response.json()
    assert len(body["scenarios"]) == 8
    assert {s["claim_id"] for s in body["scenarios"]} == {
        "ACC-2048", "ACC-3010", "ACC-3011", "ACC-3012", "ACC-3013", "ACC-3014", "ACC-3015", "ACC-3016",
    }


def test_post_evaluations_run_all_pass_with_a_well_behaved_fake_model(client):
    # The fixed check pipeline always reaches the right status regardless of
    # the model, so every scenario should pass against a non-fabricating model.
    response = client.post("/evaluations/run")
    body = response.json()
    assert all(s["passed"] for s in body["scenarios"])
    assert body["metrics"]["accuracy"] == 1.0
    assert body["metrics"]["missed_conflicts"] == 0
    assert body["metrics"]["false_review_required_count"] == 0
    assert body["dataset_version"]
    assert body["model_tag"]
    assert body["git_commit"]


def test_post_evaluations_run_citation_validity_reflects_fabrications(make_client):
    adapter = FakeModelAdapter(summary_text="Summary with one real [POL-1007] and one fake [NOT-REAL-ID] citation.")
    with make_client(adapter) as client:
        response = client.post("/evaluations/run")
    metrics = response.json()["metrics"]
    assert metrics["citation_validity_rate"] is not None
    assert metrics["citation_validity_rate"] < 1.0


def test_post_evaluations_run_does_not_pollute_claims_queue(client):
    """Evaluation runs are scratch work, not real assessments -- they must
    not show up as a claim's "last run" in the queue."""
    client.post("/evaluations/run")
    body = client.get("/claims").json()
    assert all(c["last_run_status"] is None for c in body["claims"])
