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
