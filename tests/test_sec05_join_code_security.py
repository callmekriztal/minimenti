import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import app.models as models
import app.routers.presentations as pres_router

def test_generate_join_code_uses_secrets():
    """SEC-05: generate_join_code must use secrets module instead of random."""
    import secrets
    with patch("secrets.choice", wraps=secrets.choice) as mock_secrets_choice:
        code = models.generate_join_code()
        assert len(code) == 6
        assert code.isdigit()
        assert mock_secrets_choice.call_count == 6


def test_create_presentation_retries_on_collision_and_succeeds(client: TestClient):
    """SEC-05: On join_code collision, create_presentation retries up to 5 times and succeeds."""
    # 1. Create an initial presentation with code "111111"
    res1 = client.post(
        "/presentations",
        json={"title": "First", "polls": [{"question": "Q1", "options": ["A", "B"]}]},
    )
    assert res1.status_code == 201
    existing_code = res1.json()["join_code"]

    # 2. Mock generate_join_code to simulate collisions:
    # First 2 attempts return existing_code, 3rd attempt returns a unique code
    call_count = 0
    unique_code = "777888"

    def mock_generator():
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            return existing_code
        return unique_code

    with patch.object(models, "generate_join_code", side_effect=mock_generator), \
         patch.object(pres_router, "generate_join_code", side_effect=mock_generator):
        res2 = client.post(
            "/presentations",
            json={"title": "Second", "polls": [{"question": "Q2", "options": ["C", "D"]}]},
        )
        assert res2.status_code == 201
        assert res2.json()["join_code"] == unique_code
        assert call_count == 3


def test_create_presentation_fails_after_5_collisions(client: TestClient):
    """SEC-05: If collision persists for 5 attempts, fail gracefully with HTTP 500."""
    res1 = client.post(
        "/presentations",
        json={"title": "First", "polls": [{"question": "Q1", "options": ["A", "B"]}]},
    )
    assert res1.status_code == 201
    existing_code = res1.json()["join_code"]

    call_count = 0
    def mock_generator_always_collide():
        nonlocal call_count
        call_count += 1
        return existing_code

    with patch.object(models, "generate_join_code", side_effect=mock_generator_always_collide), \
         patch.object(pres_router, "generate_join_code", side_effect=mock_generator_always_collide):
        res_fail = client.post(
            "/presentations",
            json={"title": "Collision", "polls": [{"question": "QC", "options": ["X", "Y"]}]},
        )
        assert res_fail.status_code == 500
        assert call_count == 5
