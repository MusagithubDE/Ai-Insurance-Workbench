"""End-to-end tests for the 8 synthetic scenarios, using the real fixtures
and the fixed evidence-gathering pipeline. No model call is involved -
status comes entirely from deterministic checks."""
from app.pipeline import run_assessment


def checks_by_id(result):
    return {c.check_id: c for c in result.checks}


def test_all_scenarios_reach_expected_status(conn, claim_fixtures):
    for claim_id, fixture in claim_fixtures.items():
        result = run_assessment(conn, claim_id, user_role="assessor")
        assert result.status == fixture["expected_status"], (
            f"{claim_id}: expected {fixture['expected_status']}, got {result.status}"
        )


def test_scenario_1_date_conflict_crosses_cover_start(conn):
    result = run_assessment(conn, "ACC-2048", user_role="assessor")
    assert result.status == "REVIEW_REQUIRED"
    checks = checks_by_id(result)
    assert checks["policy_in_force"].status == "fail"
    assert checks["incident_date_consistency"].status == "fail"
    assert "REP-014" in checks["incident_date_consistency"].evidence_ids


def test_scenario_2_clean_claim(conn):
    result = run_assessment(conn, "ACC-3010", user_role="assessor")
    assert result.status == "READY_FOR_HUMAN_REVIEW"
    assert all(c.status == "pass" for c in result.checks)


def test_scenario_3_premium_bounced(conn):
    result = run_assessment(conn, "ACC-3011", user_role="assessor")
    assert result.status == "REVIEW_REQUIRED"
    assert checks_by_id(result)["premium_paid"].status == "fail"


def test_scenario_4_third_party_only_own_damage(conn):
    result = run_assessment(conn, "ACC-3012", user_role="assessor")
    assert result.status == "REVIEW_REQUIRED"
    assert checks_by_id(result)["cover_type_matches_loss"].status == "fail"


def test_scenario_5_driver_not_listed(conn):
    result = run_assessment(conn, "ACC-3013", user_role="assessor")
    assert result.status == "REVIEW_REQUIRED"
    assert checks_by_id(result)["driver_listed"].status == "fail"


def test_scenario_6_police_report_missing(conn):
    result = run_assessment(conn, "ACC-3014", user_role="assessor")
    assert result.status == "REVIEW_REQUIRED"
    checks = checks_by_id(result)
    assert checks["police_report_present"].status == "fail"
    assert checks["incident_date_consistency"].status == "unknown"


def test_scenario_7_prompt_injection_treated_as_data(conn):
    result = run_assessment(conn, "ACC-3015", user_role="assessor")
    assert result.status == "READY_FOR_HUMAN_REVIEW"
    assert all(c.status == "pass" for c in result.checks)
    note = next(d for d in result.evidence["documents"] if d["doc_id"] == "DOC-NOTE-3015")
    assert "Ignore all previous instructions" in note["text"]


def test_scenario_8_billing_tool_timeout_is_incomplete(conn):
    result = run_assessment(conn, "ACC-3016", user_role="assessor")
    assert result.status == "INCOMPLETE"
    assert result.failed_tool == "get_billing"
    assert result.checks == []
    assert "claim" in result.evidence
    assert "documents" in result.evidence
    assert "billing" not in result.evidence
    assert any(t.tool_name == "get_billing" and t.error for t in result.trace)


def test_restricted_document_hidden_from_assessor_but_visible_to_team_lead(conn):
    assessor_result = run_assessment(conn, "ACC-2048", user_role="assessor")
    lead_result = run_assessment(conn, "ACC-2048", user_role="team_lead")
    assessor_doc_ids = {d["doc_id"] for d in assessor_result.evidence["documents"]}
    lead_doc_ids = {d["doc_id"] for d in lead_result.evidence["documents"]}
    assert "DOC-INV-2048" not in assessor_doc_ids
    assert "DOC-INV-2048" in lead_doc_ids
    # Role visibility of a non-required document must not change the overall status.
    assert assessor_result.status == lead_result.status == "REVIEW_REQUIRED"


def test_tool_call_budget_not_exceeded(conn):
    result = run_assessment(conn, "ACC-3010", user_role="assessor")
    assert len(result.trace) <= 8
