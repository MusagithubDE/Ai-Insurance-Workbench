"""Read-only, allow-listed data-access tools, backed by SQLite.

Every tool is a pure read: it looks up records and returns plain dicts, never
mutates data. `ToolRegistry` is the single gate every call passes through —
it enforces the allow-list, validates arguments with Pydantic, enforces the
max-calls-per-run budget, times each call, and records a trace entry
(success or error) for every attempt, including simulated failures injected
for test scenarios.
"""
import json
import sqlite3
import time
from datetime import date
from typing import Any, Callable

from app.schemas import (
    GetBillingArgs,
    GetClaimArgs,
    GetClaimsHistoryArgs,
    GetCustomerArgs,
    GetDocumentsArgs,
    GetPolicyArgs,
    GetPolicyWordingArgs,
    ToolError,
    TraceEntry,
)

MAX_TOOL_CALLS = 8


def _row_data(row: sqlite3.Row) -> dict:
    return json.loads(row["data"])


def get_customer(conn: sqlite3.Connection, customer_id: str) -> dict:
    row = conn.execute("SELECT data FROM customers WHERE customer_id = ?", (customer_id,)).fetchone()
    if row is None:
        raise ToolError("get_customer", f"No customer found with id {customer_id!r}")
    return _row_data(row)


def get_policy(conn: sqlite3.Connection, policy_id: str) -> dict:
    row = conn.execute("SELECT data FROM policies WHERE policy_id = ?", (policy_id,)).fetchone()
    if row is None:
        raise ToolError("get_policy", f"No policy found with id {policy_id!r}")
    return _row_data(row)


def get_policy_wording(conn: sqlite3.Connection, policy_id: str, as_of_date: str) -> dict:
    policy = get_policy(conn, policy_id)
    wording_doc_id = policy["wording_doc_id"]
    row = conn.execute("SELECT data FROM policy_wordings WHERE doc_id = ?", (wording_doc_id,)).fetchone()
    if row is None:
        raise ToolError("get_policy_wording", f"No wording document found with id {wording_doc_id!r}")
    wording = _row_data(row)
    as_of = date.fromisoformat(as_of_date)
    for version in wording["versions"]:
        start = date.fromisoformat(version["effective_from"])
        end = date.fromisoformat(version["effective_to"]) if version.get("effective_to") else None
        if start <= as_of and (end is None or as_of <= end):
            return {
                "doc_id": wording["doc_id"],
                "product": wording["product"],
                "version": version["version"],
                "effective_from": version["effective_from"],
                "effective_to": version["effective_to"],
                "sections": version["sections"],
            }
    raise ToolError("get_policy_wording", f"No wording version of {wording_doc_id!r} was in force on {as_of_date}")


def get_claim(conn: sqlite3.Connection, claim_id: str) -> dict:
    row = conn.execute("SELECT data FROM claims WHERE claim_id = ?", (claim_id,)).fetchone()
    if row is None:
        raise ToolError("get_claim", f"No claim found with id {claim_id!r}")
    return _row_data(row)


def get_documents(conn: sqlite3.Connection, claim_id: str, user_role: str = "assessor") -> list[dict]:
    rows = conn.execute("SELECT data, restricted FROM documents WHERE claim_id = ?", (claim_id,)).fetchall()
    docs = []
    for row in rows:
        if row["restricted"] and user_role != "team_lead":
            continue
        docs.append(_row_data(row))
    return docs


def get_billing(conn: sqlite3.Connection, policy_id: str, month: str) -> dict | None:
    row = conn.execute(
        "SELECT data FROM billing WHERE policy_id = ? AND month = ?", (policy_id, month)
    ).fetchone()
    return _row_data(row) if row else None


def get_claims_history(conn: sqlite3.Connection, vehicle_id: str) -> list[dict]:
    rows = conn.execute("SELECT data FROM claims_history WHERE vehicle_id = ?", (vehicle_id,)).fetchall()
    return [_row_data(row) for row in rows]


# Allow-list: tool name -> (args model, underlying function)
TOOL_REGISTRY: dict[str, tuple[type, Callable]] = {
    "get_customer": (GetCustomerArgs, get_customer),
    "get_policy": (GetPolicyArgs, get_policy),
    "get_policy_wording": (GetPolicyWordingArgs, get_policy_wording),
    "get_claim": (GetClaimArgs, get_claim),
    "get_documents": (GetDocumentsArgs, get_documents),
    "get_billing": (GetBillingArgs, get_billing),
    "get_claims_history": (GetClaimsHistoryArgs, get_claims_history),
}


class ToolRegistry:
    """Gates every tool call through the allow-list, argument validation,
    the per-run call budget, and trace recording."""

    def __init__(self, conn: sqlite3.Connection, max_calls: int = MAX_TOOL_CALLS, simulate_failure: str | None = None):
        self.conn = conn
        self.max_calls = max_calls
        self.simulate_failure = simulate_failure
        self.calls = 0
        self.trace: list[TraceEntry] = []

    def call(self, tool_name: str, **kwargs: Any) -> Any:
        if tool_name not in TOOL_REGISTRY:
            self._record_error(tool_name, kwargs, 0.0, f"{tool_name!r} is not an allowed tool")
            raise ToolError(tool_name, f"{tool_name!r} is not an allowed tool")

        self.calls += 1
        if self.calls > self.max_calls:
            self._record_error(tool_name, kwargs, 0.0, f"Tool call limit of {self.max_calls} reached")
            raise ToolError(tool_name, f"Tool call limit of {self.max_calls} reached")

        args_model, func = TOOL_REGISTRY[tool_name]
        start = time.perf_counter()
        try:
            validated = args_model(**kwargs)
        except Exception as exc:  # pydantic ValidationError
            duration_ms = (time.perf_counter() - start) * 1000
            self._record_error(tool_name, kwargs, duration_ms, f"Invalid arguments: {exc}")
            raise ToolError(tool_name, f"Invalid arguments for {tool_name}: {exc}") from exc

        if self.simulate_failure == tool_name:
            duration_ms = (time.perf_counter() - start) * 1000
            message = f"Simulated timeout calling {tool_name}"
            self._record_error(tool_name, validated.model_dump(), duration_ms, message)
            raise ToolError(tool_name, message)

        try:
            result = func(self.conn, **validated.model_dump())
        except ToolError as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            self._record_error(tool_name, validated.model_dump(), duration_ms, exc.message)
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        self.trace.append(TraceEntry(
            tool_name=tool_name,
            args=validated.model_dump(),
            duration_ms=round(duration_ms, 3),
            result_summary=_summarize(result),
            error=None,
        ))
        return result

    def _record_error(self, tool_name: str, args: dict, duration_ms: float, message: str) -> None:
        self.trace.append(TraceEntry(
            tool_name=tool_name,
            args=args,
            duration_ms=round(duration_ms, 3),
            result_summary="(no result)",
            error=message,
        ))


def _summarize(result: Any) -> str:
    if result is None:
        return "No record found"
    if isinstance(result, list):
        return f"{len(result)} record(s)"
    if isinstance(result, dict):
        key = next((k for k in ("claim_id", "policy_id", "customer_id", "doc_id", "bill_id") if k in result), None)
        return f"Record {result[key]}" if key else "1 record"
    return str(result)
