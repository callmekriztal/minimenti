import pytest
from fastapi.testclient import TestClient

def test_single_poll_options_hide_is_correct_until_closed(client: TestClient):
    """SEC-02: Public poll schemas must not reveal is_correct until the poll is closed."""
    create_res = client.post(
        "/polls",
        json={
            "question": "What is the capital of Japan?",
            "options": ["Kyoto", "Tokyo", "Osaka"],
            "correct_option_index": 1,
        },
    )
    assert create_res.status_code == 201
    poll_data = create_res.json()
    poll_id = poll_data["id"]
    admin_key = poll_data["admin_key"]

    # 1. Fetch open poll publicly
    get_res = client.get(f"/polls/{poll_id}")
    assert get_res.status_code == 200
    open_poll = get_res.json()
    assert open_poll["is_closed"] is False

    # is_correct must be completely absent from options
    for opt in open_poll["options"]:
        assert "is_correct" not in opt, f"is_correct leaked in option: {opt}"

    # 2. Close the poll
    close_res = client.post(
        f"/polls/{poll_id}/close",
        headers={"X-Admin-Key": admin_key},
    )
    assert close_res.status_code == 200

    # 3. Fetch closed poll publicly
    closed_get = client.get(f"/polls/{poll_id}")
    assert closed_get.status_code == 200
    closed_poll = closed_get.json()
    assert closed_poll["is_closed"] is True

    # is_correct must now be revealed
    options = closed_poll["options"]
    assert options[0]["is_correct"] is False
    assert options[1]["is_correct"] is True
    assert options[2]["is_correct"] is False


def test_presentation_active_poll_hides_is_correct_until_slide_ended(client: TestClient):
    """SEC-02: Active poll in presentation state must not reveal is_correct until slide ended / finished."""
    create_res = client.post(
        "/presentations",
        json={
            "title": "Geography Quiz",
            "polls": [
                {
                    "question": "Capital of Germany?",
                    "options": ["Berlin", "Munich"],
                    "correct_option_index": 0,
                }
            ],
        },
    )
    assert create_res.status_code == 201
    pres_data = create_res.json()
    pres_id = pres_data["id"]
    join_code = pres_data["join_code"]
    admin_key = pres_data["admin_key"]

    # 1. Public lookup by code while active
    state_res = client.get(f"/presentations/code/{join_code}")
    assert state_res.status_code == 200
    state = state_res.json()
    assert state["is_finished"] is False
    assert state["active_poll"] is not None

    for opt in state["active_poll"]["options"]:
        assert "is_correct" not in opt, f"is_correct leaked in active_poll: {opt}"

    # 2. Advance / finish presentation
    next_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert next_res.status_code == 200
    finished_state = next_res.json()
    assert finished_state["is_finished"] is True

    # 3. Check finished presentation state
    finished_lookup = client.get(f"/presentations/code/{join_code}")
    assert finished_lookup.status_code == 200
    finished_data = finished_lookup.json()
    if finished_data["active_poll"]:
        for opt in finished_data["active_poll"]["options"]:
            assert "is_correct" in opt
