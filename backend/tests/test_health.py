from fastapi.testclient import TestClient
from src.main import app


def test_health_returns_standard_success_payload() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "code": 200,
        "message": "success",
        "data": {
            "status": "ok",
            "service": "markdown-reader",
        },
    }
