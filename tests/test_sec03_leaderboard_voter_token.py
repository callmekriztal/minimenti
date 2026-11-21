import pytest
from fastapi.testclient import TestClient

def test_leaderboard_does_not_expose_voter_token(client: TestClient):
    """SEC-03: LeaderboardEntryRead must not expose private voter_token in responses."""
    create_res = client.post(
        "/presentations",
        json={
            "title": "Token Privacy Quiz",
            "polls": [
                {
                    "question": "What is 1+1?",
                    "options": ["2", "3"],
                    "correct_option_index": 0,
                }
            ],
        },
    )
    assert create_res.status_code == 201
    pres = create_res.json()
    pres_id = pres["id"]
    join_code = pres["join_code"]
    admin_key = pres["admin_key"]
    q_id = pres["polls"][0]["id"]
    opt_2 = pres["polls"][0]["options"][0]["id"]

    # Participant joins with a secret voter token
    secret_token = "secret-voter-device-token-12345"
    join_res = client.post(
        f"/presentations/{pres_id}/join",
        json={"voter_token": secret_token, "nickname": "SecretAlice"},
    )
    assert join_res.status_code == 200

    # Vote
    vote_res = client.post(
        f"/polls/{q_id}/votes",
        json={"option_id": opt_2, "voter_token": secret_token, "nickname": "SecretAlice"},
    )
    assert vote_res.status_code == 201

    # Finish presentation
    finish_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert finish_res.status_code == 200
    state = finish_res.json()

    assert len(state["leaderboard"]) >= 1
    for entry in state["leaderboard"]:
        assert "voter_token" not in entry, f"voter_token exposed on leaderboard: {entry}"
