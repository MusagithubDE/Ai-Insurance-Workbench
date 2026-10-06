"""SQLite storage, seeded from JSON fixtures.

Each domain table stores its primary lookup keys as real columns plus the
full record as a JSON blob in `data`. This keeps the schema simple while the
fixtures are the single source of truth for record shape.
"""
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "workbench.sqlite3"
DEFAULT_FIXTURES_DIR = BACKEND_DIR / "fixtures"


def get_db_path() -> Path:
    return Path(os.environ.get("WORKBENCH_DB_PATH", str(DEFAULT_DB_PATH)))


def get_fixtures_dir() -> Path:
    return Path(os.environ.get("WORKBENCH_FIXTURES_DIR", str(DEFAULT_FIXTURES_DIR)))


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or get_db_path()
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS policies (
    policy_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS policy_wordings (
    doc_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    restricted INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing (
    bill_id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    month TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims_history (
    history_id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    result_json TEXT NOT NULL,
    events_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    check_id TEXT NOT NULL,
    verdict TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);
"""


def init_db(db_path: Path | None = None) -> None:
    with closing(connect(db_path)) as conn, conn:
        conn.executescript(SCHEMA)


def _load_fixture(fixtures_dir: Path, name: str) -> list[dict]:
    with open(fixtures_dir / name, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_from_fixtures(db_path: Path | None = None, fixtures_dir: Path | None = None) -> None:
    """Clears domain tables and reloads them from the JSON fixtures. Idempotent."""
    fixtures_dir = fixtures_dir or get_fixtures_dir()
    customers = _load_fixture(fixtures_dir, "customers.json")
    policies = _load_fixture(fixtures_dir, "policies.json")
    policy_wordings = _load_fixture(fixtures_dir, "policy_wordings.json")
    claims = _load_fixture(fixtures_dir, "claims.json")
    documents = _load_fixture(fixtures_dir, "documents.json")
    billing = _load_fixture(fixtures_dir, "billing.json")
    claims_history = _load_fixture(fixtures_dir, "claims_history.json")

    with closing(connect(db_path)) as conn, conn:
        conn.executescript(SCHEMA)
        for table in ("customers", "policies", "policy_wordings", "claims", "documents", "billing", "claims_history"):
            conn.execute(f"DELETE FROM {table}")

        conn.executemany(
            "INSERT INTO customers VALUES (?, ?)",
            [(c["customer_id"], json.dumps(c)) for c in customers],
        )
        conn.executemany(
            "INSERT INTO policies VALUES (?, ?, ?)",
            [(p["policy_id"], p["customer_id"], json.dumps(p)) for p in policies],
        )
        conn.executemany(
            "INSERT INTO policy_wordings VALUES (?, ?)",
            [(w["doc_id"], json.dumps(w)) for w in policy_wordings],
        )
        conn.executemany(
            "INSERT INTO claims VALUES (?, ?, ?, ?, ?)",
            [(c["claim_id"], c["policy_id"], c["customer_id"], c["vehicle_id"], json.dumps(c)) for c in claims],
        )
        conn.executemany(
            "INSERT INTO documents VALUES (?, ?, ?, ?)",
            [(d["doc_id"], d["claim_id"], int(bool(d.get("restricted"))), json.dumps(d)) for d in documents],
        )
        conn.executemany(
            "INSERT INTO billing VALUES (?, ?, ?, ?)",
            [(b["bill_id"], b["policy_id"], b["month"], json.dumps(b)) for b in billing],
        )
        conn.executemany(
            "INSERT INTO claims_history VALUES (?, ?, ?)",
            [(h["history_id"], h["vehicle_id"], json.dumps(h)) for h in claims_history],
        )


def ensure_seeded(db_path: Path | None = None, fixtures_dir: Path | None = None) -> None:
    """Seeds the database if it has no claims yet. Used on app startup."""
    path = db_path or get_db_path()
    init_db(path)
    with closing(connect(path)) as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM claims").fetchone()["n"]
    if count == 0:
        seed_from_fixtures(path, fixtures_dir)


def save_run(
    conn: sqlite3.Connection,
    run_id: str,
    claim_id: str,
    user_role: str,
    status: str,
    created_at: str,
    result_json: str,
    events_json: str,
) -> None:
    with conn:
        conn.execute(
            "INSERT INTO runs (run_id, claim_id, user_role, status, created_at, result_json, events_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run_id, claim_id, user_role, status, created_at, result_json, events_json),
        )


def get_run(conn: sqlite3.Connection, run_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()


def latest_run_for_claim(conn: sqlite3.Connection, claim_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT run_id, status FROM runs WHERE claim_id = ? ORDER BY created_at DESC LIMIT 1",
        (claim_id,),
    ).fetchone()


def save_feedback(
    conn: sqlite3.Connection,
    feedback_id: str,
    run_id: str,
    check_id: str,
    verdict: str,
    note: str | None,
    created_at: str,
) -> None:
    with conn:
        conn.execute(
            "INSERT INTO feedback (feedback_id, run_id, check_id, verdict, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (feedback_id, run_id, check_id, verdict, note, created_at),
        )
