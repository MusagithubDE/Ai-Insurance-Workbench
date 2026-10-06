import json

import pytest

from app import db as db_module


@pytest.fixture()
def conn(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    db_module.seed_from_fixtures(db_path=db_path, fixtures_dir=db_module.DEFAULT_FIXTURES_DIR)
    connection = db_module.connect(db_path)
    yield connection
    connection.close()


@pytest.fixture()
def claim_fixtures():
    with open(db_module.DEFAULT_FIXTURES_DIR / "claims.json", "r", encoding="utf-8") as f:
        return {c["claim_id"]: c for c in json.load(f)}


class FakeModelAdapter:
    """Deterministic stand-in for a real model, so API/model-task tests
    don't depend on Ollama being installed or take seconds per call. Records
    every call so tests can assert on what was asked of it."""

    def __init__(
        self,
        summary_text: str = "This is a fake, deterministic summary for testing.",
        draft: dict | None = None,
        fail: bool = False,
        responses: list[dict | None] | None = None,
    ):
        self.summary_text = summary_text
        self.draft = draft or {
            "sms": "Hi, we're missing your police report for your claim. Please send it when you can. Thanks.",
            "email_subject": "Missing document for your claim",
            "email_body": "Hello, we still need your police report to continue processing your claim. Please send it at your earliest convenience.",
        }
        self.fail = fail
        self.responses = responses
        self.calls: list[tuple[str, str, dict]] = []

    def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict | None:
        self.calls.append((system_prompt, user_prompt, schema))
        if self.responses is not None:
            index = min(len(self.calls) - 1, len(self.responses) - 1)
            return self.responses[index]
        if self.fail:
            return None
        if "summary" in schema.get("properties", {}):
            return {"summary": self.summary_text}
        return dict(self.draft)


@pytest.fixture()
def fake_model_adapter():
    return FakeModelAdapter()
