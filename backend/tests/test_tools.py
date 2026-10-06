import pytest

from app.schemas import ToolError
from app.tools import ToolRegistry, get_billing, get_documents


def test_get_customer_found(conn):
    registry = ToolRegistry(conn)
    result = registry.call("get_customer", customer_id="CUS-1001")
    assert result["name"] == "Thabo Mokoena"
    assert len(registry.trace) == 1
    assert registry.trace[0].error is None


def test_get_customer_not_found(conn):
    registry = ToolRegistry(conn)
    with pytest.raises(ToolError):
        registry.call("get_customer", customer_id="CUS-9999")
    assert registry.trace[0].error is not None


def test_disallowed_tool_rejected(conn):
    registry = ToolRegistry(conn)
    with pytest.raises(ToolError):
        registry.call("delete_customer", customer_id="CUS-1001")


def test_invalid_arguments_rejected(conn):
    registry = ToolRegistry(conn)
    with pytest.raises(ToolError):
        registry.call("get_customer", customer_id="CUS-1001", extra_arg="nope")


def test_max_calls_enforced(conn):
    registry = ToolRegistry(conn, max_calls=2)
    registry.call("get_customer", customer_id="CUS-1001")
    registry.call("get_customer", customer_id="CUS-1001")
    with pytest.raises(ToolError):
        registry.call("get_customer", customer_id="CUS-1001")
    assert registry.trace[-1].error is not None


def test_simulated_failure(conn):
    registry = ToolRegistry(conn, simulate_failure="get_billing")
    with pytest.raises(ToolError) as excinfo:
        registry.call("get_billing", policy_id="POL-2016", month="2026-02")
    assert excinfo.value.tool_name == "get_billing"
    assert "Simulated" in registry.trace[-1].error


def test_policy_wording_version_selection(conn):
    registry = ToolRegistry(conn)
    v1 = registry.call("get_policy_wording", policy_id="POL-1007", as_of_date="2025-06-01")
    assert v1["version"] == "v1"
    v2 = registry.call("get_policy_wording", policy_id="POL-1007", as_of_date="2026-08-18")
    assert v2["version"] == "v2"


def test_get_billing_missing_record_returns_none(conn):
    result = get_billing(conn, policy_id="POL-1007", month="1999-01")
    assert result is None


def test_get_documents_filters_restricted_for_assessor(conn):
    docs = get_documents(conn, claim_id="ACC-2048", user_role="assessor")
    doc_ids = {d["doc_id"] for d in docs}
    assert "DOC-INV-2048" not in doc_ids
    assert "REP-014" in doc_ids


def test_get_documents_shows_restricted_for_team_lead(conn):
    docs = get_documents(conn, claim_id="ACC-2048", user_role="team_lead")
    doc_ids = {d["doc_id"] for d in docs}
    assert "DOC-INV-2048" in doc_ids
