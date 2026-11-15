import uuid
from fastapi import status


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}


def test_create_poll_success(client):
    payload = {
        "question": "What is your primary programming language?",
        "options": ["Python", "Rust", "Go"],
    }
    response = client.post("/polls", json=payload)
    assert response.status_code == status.HTTP_201_CREATED

    data = response.json()
    assert "id" in data
    # Ensure ID is a valid UUID
    uuid.UUID(data["id"])
    assert data["question"] == payload["question"]
    assert data["is_closed"] is False
    assert data["closes_at"] is None
    assert len(data["options"]) == 3

    # Check option positions and texts
    for idx, expected_text in enumerate(["Python", "Rust", "Go"]):
        assert data["options"][idx]["text"] == expected_text
        assert data["options"][idx]["position"] == idx


def test_create_poll_boundary_options(client):
    # Minimum boundary: exactly 2 options
    payload_min = {
        "question": "Tabs or Spaces?",
        "options": ["Tabs", "Spaces"],
    }
    res_min = client.post("/polls", json=payload_min)
    assert res_min.status_code == status.HTTP_201_CREATED
    assert len(res_min.json()["options"]) == 2

    # Maximum boundary: exactly 10 options
    payload_max = {
        "question": "Rate from 1 to 10",
        "options": [f"Option {i}" for i in range(1, 11)],
    }
    res_max = client.post("/polls", json=payload_max)
    assert res_max.status_code == status.HTTP_201_CREATED
    assert len(res_max.json()["options"]) == 10


def test_get_poll_success(client):
    create_res = client.post(
        "/polls",
        json={
            "question": "Favorite framework?",
            "options": ["FastAPI", "Django"],
        },
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    poll_id = create_res.json()["id"]

    get_res = client.get(f"/polls/{poll_id}")
    assert get_res.status_code == status.HTTP_200_OK

    data = get_res.json()
    assert data["id"] == poll_id
    assert data["question"] == "Favorite framework?"
    assert len(data["options"]) == 2
    assert data["options"][0]["text"] == "FastAPI"
    assert data["options"][0]["position"] == 0
    assert data["options"][1]["text"] == "Django"
    assert data["options"][1]["position"] == 1


def test_get_poll_not_found(client):
    random_id = uuid.uuid4()
    response = client.get(f"/polls/{random_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Poll not found"


def test_get_poll_invalid_uuid(client):
    response = client.get("/polls/not-a-valid-uuid")
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_reject_too_few_options(client):
    # 0 options
    res_0 = client.post("/polls", json={"question": "Test?", "options": []})
    assert res_0.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 1 option
    res_1 = client.post("/polls", json={"question": "Test?", "options": ["Solo"]})
    assert res_1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_reject_too_many_options(client):
    # 11 options
    payload = {
        "question": "Too many?",
        "options": [f"Option {i}" for i in range(11)],
    }
    response = client.post("/polls", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_reject_empty_question(client):
    # Empty string
    res_empty = client.post(
        "/polls",
        json={"question": "", "options": ["Yes", "No"]},
    )
    assert res_empty.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Whitespace only
    res_spaces = client.post(
        "/polls",
        json={"question": "   \n\t  ", "options": ["Yes", "No"]},
    )
    assert res_spaces.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_reject_empty_option_text(client):
    # Empty string option
    res_empty = client.post(
        "/polls",
        json={"question": "Valid question?", "options": ["Option 1", ""]},
    )
    assert res_empty.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Whitespace only option
    res_spaces = client.post(
        "/polls",
        json={"question": "Valid question?", "options": ["Option 1", "   "]},
    )
    assert res_spaces.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_cast_vote_success(client):
    poll_res = client.post(
        "/polls",
        json={"question": "Cat or Dog?", "options": ["Cat", "Dog"]},
    )
    poll_id = poll_res.json()["id"]
    option_id = poll_res.json()["options"][0]["id"]

    vote_res = client.post(
        f"/polls/{poll_id}/votes",
        json={"option_id": option_id, "voter_token": "browser-session-1"},
    )
    assert vote_res.status_code == status.HTTP_201_CREATED
    data = vote_res.json()
    assert data["poll_id"] == poll_id
    assert data["option_id"] == option_id
    assert "id" in data
    assert "created_at" in data


def test_cast_vote_duplicate_rejected(client):
    poll_res = client.post(
        "/polls",
        json={"question": "Tea or Coffee?", "options": ["Tea", "Coffee"]},
    )
    poll_id = poll_res.json()["id"]
    option_tea = poll_res.json()["options"][0]["id"]
    option_coffee = poll_res.json()["options"][1]["id"]

    # First vote succeeds
    res1 = client.post(
        f"/polls/{poll_id}/votes",
        json={"option_id": option_tea, "voter_token": "same-device-token"},
    )
    assert res1.status_code == status.HTTP_201_CREATED

    # Second vote from the same voter token fails with 409 Conflict
    res2 = client.post(
        f"/polls/{poll_id}/votes",
        json={"option_id": option_coffee, "voter_token": "same-device-token"},
    )
    assert res2.status_code == status.HTTP_409_CONFLICT
    assert res2.json()["detail"] == "You have already voted in this poll"


def test_same_voter_different_polls(client):
    # Same voter can vote in two separate polls
    p1 = client.post("/polls", json={"question": "Q1?", "options": ["A", "B"]}).json()
    p2 = client.post("/polls", json={"question": "Q2?", "options": ["C", "D"]}).json()

    token = "global-voter-id"
    res1 = client.post(
        f"/polls/{p1['id']}/votes",
        json={"option_id": p1["options"][0]["id"], "voter_token": token},
    )
    assert res1.status_code == status.HTTP_201_CREATED

    res2 = client.post(
        f"/polls/{p2['id']}/votes",
        json={"option_id": p2["options"][0]["id"], "voter_token": token},
    )
    assert res2.status_code == status.HTTP_201_CREATED


def test_cast_vote_invalid_option(client):
    p1 = client.post("/polls", json={"question": "Q1?", "options": ["A", "B"]}).json()
    p2 = client.post("/polls", json={"question": "Q2?", "options": ["C", "D"]}).json()

    # Voting in p1 with an option from p2 must be rejected
    foreign_option_id = p2["options"][0]["id"]
    res = client.post(
        f"/polls/{p1['id']}/votes",
        json={"option_id": foreign_option_id, "voter_token": "device-1"},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.json()["detail"] == "Invalid option for this poll"


def test_cast_vote_nonexistent_poll(client):
    random_id = uuid.uuid4()
    res = client.post(
        f"/polls/{random_id}/votes",
        json={"option_id": 9999, "voter_token": "device-1"},
    )
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_cast_vote_closed_poll(client, db_session):
    from app.models import Poll as PollModel

    poll_res = client.post(
        "/polls",
        json={"question": "Closed?", "options": ["Yes", "No"]},
    )
    poll_id = poll_res.json()["id"]
    option_id = poll_res.json()["options"][0]["id"]

    # Manually close the poll in DB
    db_poll = db_session.get(PollModel, uuid.UUID(poll_id))
    db_poll.is_closed = True
    db_session.commit()

    res = client.post(
        f"/polls/{poll_id}/votes",
        json={"option_id": option_id, "voter_token": "device-closed"},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.json()["detail"] == "Poll is closed"


def test_get_poll_results_aggregation(client):
    poll_res = client.post(
        "/polls",
        json={"question": "Color?", "options": ["Red", "Blue", "Green"]},
    )
    poll_id = poll_res.json()["id"]
    options = poll_res.json()["options"]
    opt_red = options[0]["id"]
    opt_blue = options[1]["id"]
    opt_green = options[2]["id"]

    # Cast 2 votes for Red, 1 for Blue, 0 for Green
    client.post(f"/polls/{poll_id}/votes", json={"option_id": opt_red, "voter_token": "v1"})
    client.post(f"/polls/{poll_id}/votes", json={"option_id": opt_red, "voter_token": "v2"})
    client.post(f"/polls/{poll_id}/votes", json={"option_id": opt_blue, "voter_token": "v3"})

    results_res = client.get(f"/polls/{poll_id}/results")
    assert results_res.status_code == status.HTTP_200_OK

    data = results_res.json()
    assert data["poll_id"] == poll_id
    assert data["total_votes"] == 3
    assert len(data["results"]) == 3

    # Check that option with 0 votes is properly included via outerjoin
    counts = {r["text"]: r["vote_count"] for r in data["results"]}
    assert counts["Red"] == 2
    assert counts["Blue"] == 1
    assert counts["Green"] == 0


def test_stream_poll_not_found(client):
    random_id = uuid.uuid4()
    response = client.get(f"/polls/{random_id}/stream")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_stream_poll_initial_event(client):
    import json

    poll_res = client.post(
        "/polls",
        json={"question": "Stream test?", "options": ["Yes", "No"]},
    )
    poll_id = poll_res.json()["id"]

    with client.stream("GET", f"/polls/{poll_id}/stream") as stream_res:
        assert stream_res.status_code == status.HTTP_200_OK
        assert "text/event-stream" in stream_res.headers["content-type"]
        for line in stream_res.iter_lines():
            if line.startswith("data: "):
                data = json.loads(line[6:])
                assert data["poll_id"] == poll_id
                assert data["total_votes"] == 0
                assert len(data["results"]) == 2
                break


def test_broadcaster_subscribe_broadcast_unsubscribe():
    from app.broadcaster import Broadcaster

    b = Broadcaster()
    test_id = uuid.uuid4()

    q1 = b.subscribe(test_id)
    q2 = b.subscribe(test_id)
    assert len(b._subscribers[test_id]) == 2

    b.broadcast(test_id, "vote_updated")
    assert q1.get_nowait() == "vote_updated"
    assert q2.get_nowait() == "vote_updated"

    b.unsubscribe(test_id, q1)
    assert len(b._subscribers[test_id]) == 1

    b.unsubscribe(test_id, q2)
    assert test_id not in b._subscribers


