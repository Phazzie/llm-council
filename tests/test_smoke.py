"""Smoke tests for the FastAPI app. No network calls."""

from fastapi.testclient import TestClient

from backend import storage
from backend.main import app


def test_app_imports_and_health_route_responds():
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "LLM Council API"}


def test_list_conversations_route(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "DATA_DIR", str(tmp_path))
    with TestClient(app) as client:
        response = client.get("/api/conversations")

    assert response.status_code == 200
    assert response.json() == []
