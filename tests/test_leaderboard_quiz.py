import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

# In-memory SQLite for clean test isolation
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_quiz_presentation_creation_and_leaderboard(client):
    # 1. Create a 2-question quiz deck
    # Q1: Correct option is index 0 ("Paris")
    # Q2: Correct option is index 1 ("Mars")
    payload = {
        "title": "General Trivia Quiz",
        "polls": [
            {
                "question": "What is the capital of France?",
                "options": ["Paris", "Lyon", "Marseille"],
                "correct_option_index": 0,
            },
            {
                "question": "Which planet is known as the Red Planet?",
                "options": ["Venus", "Mars", "Jupiter"],
                "correct_option_index": 1,
            },
        ],
    }

    create_res = client.post("/presentations", json=payload)
    assert create_res.status_code == 201
    pres_data = create_res.json()
    pres_id = pres_data["id"]
    join_code = pres_data["join_code"]
    admin_key = pres_data["admin_key"]
    assert len(pres_data["polls"]) == 2

    q1 = pres_data["polls"][0]
    q2 = pres_data["polls"][1]
    q1_opt_paris = q1["options"][0]["id"]
    q1_opt_lyon = q1["options"][1]["id"]
    q2_opt_mars = q2["options"][1]["id"]
    q2_opt_venus = q2["options"][0]["id"]

    # 2. Join presentation by code
    join_res_alice = client.post(
        f"/presentations/code/{join_code}/join",
        json={"voter_token": "token_alice", "nickname": "Alice"},
    )
    assert join_res_alice.status_code == 200
    assert join_res_alice.json()["participants_count"] == 1

    join_res_bob = client.post(
        f"/presentations/{pres_id}/join",
        json={"voter_token": "token_bob", "nickname": "Bob"},
    )
    assert join_res_bob.status_code == 200
    assert join_res_bob.json()["participants_count"] == 2

    # 3. Slide 1 Voting:
    # Alice answers correctly (Paris), Bob answers incorrectly (Lyon)
    v1_alice = client.post(
        f"/polls/{q1['id']}/votes",
        json={"option_id": q1_opt_paris, "voter_token": "token_alice", "nickname": "Alice"},
    )
    assert v1_alice.status_code == 201

    v1_bob = client.post(
        f"/polls/{q1['id']}/votes",
        json={"option_id": q1_opt_lyon, "voter_token": "token_bob", "nickname": "Bob"},
    )
    assert v1_bob.status_code == 201

    # 4. Advance slide to Q2
    step_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert step_res.status_code == 200
    assert step_res.json()["active_poll_index"] == 1

    # 5. Slide 2 Voting:
    # Alice answers correctly (Mars), Bob answers incorrectly (Venus)
    v2_alice = client.post(
        f"/polls/{q2['id']}/votes",
        json={"option_id": q2_opt_mars, "voter_token": "token_alice"},
    )
    assert v2_alice.status_code == 201

    v2_bob = client.post(
        f"/polls/{q2['id']}/votes",
        json={"option_id": q2_opt_venus, "voter_token": "token_bob"},
    )
    assert v2_bob.status_code == 201

    # 6. Finish presentation
    finish_res = client.post(
        f"/presentations/{pres_id}/next",
        headers={"X-Admin-Key": admin_key},
    )
    assert finish_res.status_code == 200
    finished_state = finish_res.json()
    assert finished_state["is_finished"] is True

    # 7. Check Leaderboard
    leaderboard = finished_state["leaderboard"]
    assert len(leaderboard) == 2

    # Alice should be Rank 1 with 2 correct answers (2000 points)
    assert leaderboard[0]["nickname"] == "Alice"
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["score"] == 2000
    assert leaderboard[0]["correct_count"] == 2

    # Bob should be Rank 2 with 0 correct answers (0 points)
    assert leaderboard[1]["nickname"] == "Bob"
    assert leaderboard[1]["rank"] == 2
    assert leaderboard[1]["score"] == 0
    assert leaderboard[1]["correct_count"] == 0


def test_single_poll_correct_answer_revealed_on_close(client):
    res = client.post(
        "/polls",
        json={
            "question": "What is 2 + 2?",
            "options": ["3", "4", "5"],
            "correct_option_index": 1,
        },
    )
    assert res.status_code == 201
    poll = res.json()
    poll_id = poll["id"]
    admin_key = poll["admin_key"]

    # Initial get: results before close do not reveal is_correct
    results_before = client.get(f"/polls/{poll_id}/results").json()
    assert results_before["is_closed"] is False
    assert results_before["results"][1]["is_correct"] is None

    # Close the poll
    close_res = client.post(
        f"/polls/{poll_id}/close",
        headers={"X-Admin-Key": admin_key},
    )
    assert close_res.status_code == 200

    # Results after close reveal is_correct
    results_after = client.get(f"/polls/{poll_id}/results").json()
    assert results_after["is_closed"] is True
    assert results_after["results"][0]["is_correct"] is False
    assert results_after["results"][1]["is_correct"] is True
    assert results_after["results"][2]["is_correct"] is False
