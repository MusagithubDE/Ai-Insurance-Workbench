"""Read helpers for the claims queue. Direct SQL reads for display purposes
-- not gated through ToolRegistry, since the queue is a UI convenience, not
part of an assessment run's tool-call budget."""
import json
import sqlite3
from datetime import date

from app import db


def list_claims_queue(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT c.data AS claim_data, cu.data AS customer_data "
        "FROM claims c JOIN customers cu ON cu.customer_id = c.customer_id"
    ).fetchall()
    today = date.today()
    items = []
    for row in rows:
        claim = json.loads(row["claim_data"])
        customer = json.loads(row["customer_data"])
        incident = date.fromisoformat(claim["incident_date"])
        last_run = db.latest_run_for_claim(conn, claim["claim_id"])
        items.append({
            "claim_id": claim["claim_id"],
            "customer_name": customer["name"],
            "incident_date": claim["incident_date"],
            "vehicle_registration": claim["vehicle_registration"],
            "claim_type": claim["claim_type"],
            "age_days": (today - incident).days,
            "last_run_status": last_run["status"] if last_run else None,
            "last_run_id": last_run["run_id"] if last_run else None,
        })
    items.sort(key=lambda i: i["incident_date"], reverse=True)
    return items
