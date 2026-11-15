import pytest
from fastapi.testclient import TestClient


def test_create_presentation_deck(client: TestClient):
    payload = {
        "title": "Engineering All-Hands Trivia",
        "polls": [
            {
                "question": "What is Python's primary concurrency model?",
                "options": ["GIL + Event Loop", "Actor Model", "Software Transactional Memory"],
            },
            {
                "question": "Which database are we using?",
                "options": ["PostgreSQL", "MongoDB", "MySQL"],
            },
        ],
    }
    response = client.post("/presentations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Engineering All-Hands Trivia"
    assert len(data["join_code"]) == 6
    assert data["join_code"].isdigit()
    assert "admin_key" in data
    assert len(data["polls"]) == 2
    assert data["polls"][0]["position"] == 0
    assert data["polls"][1]["position"] == 1


def test_get_presentation_by_code(client: TestClient):
    create_payload = {
        "title": "Room Code Demo",
        "polls": [
            {
                "question": "Question 1",
                "options": ["Opt A", "Opt B"],
            },
            {
                "question": "Question 2",
                "options": ["Opt C", "Opt D"],
            },
        ],
    }
    create_res = client.post("/presentations", json=create_payload)
    created = create_res.json()
    join_code = created["join_code"]

    res = client.get(f"/presentations/code/{join_code}")
    assert res.status_code == 200
    state = res.json()
    assert state["title"] == "Room Code Demo"
    assert state["active_poll_index"] == 0
    assert state["total_polls"] == 2
    assert state["active_poll"]["question"] == "Question 1"
    assert state["is_finished"] is False


def test_presentation_slide_stepping_with_admin_key(client: TestClient):
    create_payload = {
        "title": "Stepping Test",
        "polls": [
            {"question": "Q1", "options": ["A", "B"]},
            {"question": "Q2", "options": ["C", "D"]},
        ],
    }
    created = client.post("/presentations", json=create_payload).json()
    pres_id = created["id"]
    admin_key = created["admin_key"]

    # Try advancing without admin key -> 403
    forbidden_res = client.post(f"/presentations/{pres_id}/next")
    assert forbidden_res.status_code == 403

    # Advance to next slide with admin key
    next_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert next_res.status_code == 200
    state = next_res.json()
    assert state["active_poll_index"] == 1
    assert state["active_poll"]["question"] == "Q2"
    assert state["is_finished"] is False

    # Advance past the last slide -> finishes presentation
    finish_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert finish_res.status_code == 200
    state = finish_res.json()
    assert state["is_finished"] is True

    # Step backward -> unfinishes presentation
    prev_res = client.post(
        f"/presentations/{pres_id}/prev",
        headers={"X-Admin-Key": admin_key},
    )
    assert prev_res.status_code == 200
    state = prev_res.json()
    assert state["is_finished"] is False
    assert state["active_poll_index"] == 1
