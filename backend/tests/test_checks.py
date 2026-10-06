import copy

from app.checks import (
    check_cover_type_matches_loss,
    check_driver_listed,
    check_excess_estimate,
    check_incident_date_consistency,
    check_police_report_present,
    check_policy_in_force,
    check_premium_paid,
    check_prior_claims,
    check_required_documents,
    check_vehicle_matches_policy,
    derive_status,
)
from app.schemas import CheckResult

BASE_EVIDENCE = {
    "claim": {
        "claim_id": "ACC-TEST", "customer_id": "CUS-TEST", "policy_id": "POL-TEST",
        "vehicle_id": "VEH-TEST", "vehicle_registration": "CA 000-000", "vehicle_vin": "VINTEST0000",
        "incident_date": "2026-06-15", "claim_type": "own_damage",
        "driver_name": "Test Driver", "driver_id_number": "1234567890123",
    },
    "customer": {"customer_id": "CUS-TEST", "name": "Test Driver"},
    "policy": {
        "policy_id": "POL-TEST", "cover_type": "comprehensive",
        "cover_start_date": "2026-01-01", "cover_end_date": "2027-01-01",
        "vehicles": [{"vehicle_id": "VEH-TEST", "registration": "CA 000-000", "vin": "VINTEST0000"}],
        "listed_drivers": [{"name": "Test Driver", "id_number": "1234567890123"}],
        "excess": {
            "basic_excess": 5000,
            "additional_excesses": [
                {"reason": "Named/inexperienced driver excess", "amount": 3000, "applies_if": "unlisted_or_inexperienced_driver"}
            ],
        },
    },
    "wording": {},
    "documents": [
        {"doc_id": "DOC-CF-TEST", "claim_id": "ACC-TEST", "type": "claim_form", "fields": {"incident_date": "2026-06-15"}},
        {"doc_id": "DOC-ID-TEST", "claim_id": "ACC-TEST", "type": "id_document", "fields": {}},
        {"doc_id": "REP-TEST", "claim_id": "ACC-TEST", "type": "police_report", "fields": {"case_number": "CAS-1", "incident_date": "2026-06-15"}},
    ],
    "billing": {"bill_id": "BILL-TEST", "policy_id": "POL-TEST", "month": "2026-06", "status": "paid"},
    "history": [],
}


def ev(**overrides):
    evidence = copy.deepcopy(BASE_EVIDENCE)
    for key, value in overrides.items():
        evidence[key] = value
    return evidence


def test_policy_in_force_pass():
    result = check_policy_in_force(ev())
    assert result.status == "pass"


def test_policy_in_force_fail_before_start():
    evidence = ev()
    evidence["claim"]["incident_date"] = "2025-12-01"
    evidence["documents"][2]["fields"]["incident_date"] = "2025-12-01"
    result = check_policy_in_force(evidence)
    assert result.status == "fail"
    assert "POL-TEST" in result.reason


def test_incident_date_consistency_unknown_single_source():
    evidence = ev()
    evidence["documents"] = [d for d in evidence["documents"] if d["type"] != "police_report"]
    result = check_incident_date_consistency(evidence)
    assert result.status == "unknown"


def test_incident_date_consistency_fail_on_conflict():
    evidence = ev()
    evidence["documents"][2]["fields"]["incident_date"] = "2026-06-20"
    result = check_incident_date_consistency(evidence)
    assert result.status == "fail"
    assert "REP-TEST" in result.evidence_ids


def test_premium_paid_unknown_when_no_billing():
    result = check_premium_paid(ev(billing=None))
    assert result.status == "unknown"


def test_premium_paid_fail_when_bounced():
    billing = {"bill_id": "BILL-TEST", "policy_id": "POL-TEST", "month": "2026-06", "status": "bounced", "bounce_reason": "insufficient_funds"}
    result = check_premium_paid(ev(billing=billing))
    assert result.status == "fail"
    assert "insufficient funds" in result.reason


def test_cover_type_matches_loss_fail_third_party_own_damage():
    evidence = ev()
    evidence["policy"]["cover_type"] = "third_party_only"
    result = check_cover_type_matches_loss(evidence)
    assert result.status == "fail"


def test_vehicle_matches_policy_fail():
    evidence = ev()
    evidence["claim"]["vehicle_registration"] = "ZZ 999-999"
    evidence["claim"]["vehicle_vin"] = "DOESNOTMATCH"
    result = check_vehicle_matches_policy(evidence)
    assert result.status == "fail"


def test_vehicle_matches_policy_unknown_when_missing():
    evidence = ev()
    evidence["claim"]["vehicle_registration"] = None
    evidence["claim"]["vehicle_vin"] = None
    result = check_vehicle_matches_policy(evidence)
    assert result.status == "unknown"


def test_driver_listed_fail():
    evidence = ev()
    evidence["claim"]["driver_name"] = "Someone Else"
    evidence["claim"]["driver_id_number"] = "0000000000000"
    result = check_driver_listed(evidence)
    assert result.status == "fail"


def test_police_report_present_fail_when_missing():
    evidence = ev()
    evidence["documents"] = [d for d in evidence["documents"] if d["type"] != "police_report"]
    result = check_police_report_present(evidence)
    assert result.status == "fail"


def test_excess_estimate_adds_extra_for_unlisted_driver():
    evidence = ev()
    evidence["claim"]["driver_name"] = "Someone Else"
    evidence["claim"]["driver_id_number"] = "0000000000000"
    result = check_excess_estimate(evidence)
    assert result.status == "pass"
    assert "3,000" in result.reason or "3000" in result.reason


def test_excess_estimate_basic_only_for_listed_driver():
    result = check_excess_estimate(ev())
    assert "Named/inexperienced" not in result.reason


def test_prior_claims_neutral_when_empty():
    result = check_prior_claims(ev())
    assert result.status == "pass"
    assert "No prior claims" in result.reason


def test_prior_claims_neutral_when_present():
    history = [{"history_id": "HIST-1", "vehicle_id": "VEH-TEST", "incident_date": "2025-06-01", "claim_type": "windscreen"}]
    result = check_prior_claims(ev(history=history))
    assert result.status == "pass"
    assert "1 prior claim" in result.reason


def test_required_documents_fail_when_missing():
    evidence = ev()
    evidence["documents"] = [d for d in evidence["documents"] if d["type"] != "id_document"]
    result = check_required_documents(evidence)
    assert result.status == "fail"
    assert "id_document" in result.reason


def test_required_documents_pass_when_complete():
    result = check_required_documents(ev())
    assert result.status == "pass"


def test_derive_status_all_pass():
    checks = [CheckResult(check_id="a", label="A", status="pass", reason="ok", evidence_ids=[])]
    assert derive_status(checks) == "READY_FOR_HUMAN_REVIEW"


def test_derive_status_any_fail():
    checks = [
        CheckResult(check_id="a", label="A", status="pass", reason="ok", evidence_ids=[]),
        CheckResult(check_id="b", label="B", status="fail", reason="no", evidence_ids=[]),
    ]
    assert derive_status(checks) == "REVIEW_REQUIRED"


def test_derive_status_any_unknown():
    checks = [
        CheckResult(check_id="a", label="A", status="pass", reason="ok", evidence_ids=[]),
        CheckResult(check_id="b", label="B", status="unknown", reason="?", evidence_ids=[]),
    ]
    assert derive_status(checks) == "REVIEW_REQUIRED"
