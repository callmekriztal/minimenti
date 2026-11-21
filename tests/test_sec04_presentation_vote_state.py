import pytest
from fastapi.testclient import TestClient

def test_reject_vote_on_inactive_slide_and_finished_presentation(client: TestClient):
    """SEC-04: Reject votes if the poll is not the currently active slide or presentation is finished."""
    create_res = client.post(
        "/presentations",
        json={
            "title": "Strict Slide Order Quiz",
            "polls": [
                {"question": "Q1", "options": ["A1", "B1"]},
                {"question": "Q2", "options": ["A2", "B2"]},
            ],
        },
    )
    assert create_res.status_code == 201
    pres = create_res.json()
    pres_id = pres["id"]
    admin_key = pres["admin_key"]
    q1_id = pres["polls"][0]["id"]
    q1_opt = pres["polls"][0]["options"][0]["id"]
    q2_id = pres["polls"][1]["id"]
    q2_opt = pres["polls"][1]["options"][0]["id"]

    # 1. Attempt voting on future slide Q2 while Q1 is active -> HTTP 400
    future_res = client.post(
        f"/polls/{q2_id}/votes",
        json={"option_id": q2_opt, "voter_token": "user-1"},
    )
    assert future_res.status_code == 400, f"Expected 400 for inactive future slide, got {future_res.status_code}: {future_res.text}"

    # 2. Vote on currently active slide Q1 -> HTTP 201
    q1_res = client.post(
        f"/polls/{q1_id}/votes",
        json={"option_id": q1_opt, "voter_token": "user-1"},
    )
    assert q1_res.status_code == 201

    # 3. Advance to Q2
    step_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert step_res.status_code == 200
    assert step_res.json()["active_poll_index"] == 1

    # 4. Attempt voting on past slide Q1 while Q2 is active -> HTTP 400
    past_res = client.post(
        f"/polls/{q1_id}/votes",
        json={"option_id": q1_opt, "voter_token": "user-2"},
    )
    assert past_res.status_code == 400, f"Expected 400 for inactive past slide, got {past_res.status_code}: {past_res.text}"

    # 5. Vote on currently active slide Q2 -> HTTP 201
    q2_res = client.post(
        f"/polls/{q2_id}/votes",
        json={"option_id": q2_opt, "voter_token": "user-1"},
    )
    assert q2_res.status_code == 201

    # 6. Finish presentation
    finish_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert finish_res.status_code == 200
    assert finish_res.json()["is_finished"] is True

    # 7. Attempt voting on finished presentation -> HTTP 400
    finished_vote_res = client.post(
        f"/polls/{q2_id}/votes",
        json={"option_id": q2_opt, "voter_token": "user-3"},
    )
    assert finished_vote_res.status_code == 400, f"Expected 400 for finished presentation, got {finished_vote_res.status_code}: {finished_vote_res.text}"


def test_standalone_poll_vote_behavior_preserved(client: TestClient):
    """SEC-04: Standalone polls (no presentation_id) keep their original behavior."""
    poll_res = client.post(
        "/polls",
        json={"question": "Standalone?", "options": ["Yes", "No"]},
    )
    assert poll_res.status_code == 201
    poll_id = poll_res.json()["id"]
    opt_id = poll_res.json()["options"][0]["id"]

    vote_res = client.post(
        f"/polls/{poll_id}/votes",
        json={"option_id": opt_id, "voter_token": "standalone-voter"},
    )
    assert vote_res.status_code == 201
