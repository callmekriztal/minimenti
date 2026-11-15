import pytest
import json
from fastapi.testclient import TestClient
from app.broadcaster import broadcaster


def test_presentation_sse_stream_advancement(client: TestClient):
    # 1. Create a 2-question presentation
    create_payload = {
        "title": "SSE Advance Test",
        "polls": [
            {"question": "Question 1", "options": ["A1", "B1"]},
            {"question": "Question 2", "options": ["A2", "B2"]},
        ],
    }
    created = client.post("/presentations", json=create_payload).json()
    pres_id = created["id"]
    admin_key = created["admin_key"]
    q1_id = created["polls"][0]["id"]
    q2_id = created["polls"][1]["id"]

    # 2. Simulate audience listening to the presentation SSE queue
    queue = broadcaster.subscribe(pres_id)

    try:
        # Initial advance to next slide
        advance_res = client.post(
            f"/presentations/{pres_id}/next",
            headers={"X-Admin-Key": admin_key},
        )
        assert advance_res.status_code == 200

        # Queue should immediately have received the updated state
        assert not queue.empty()
        msg = queue.get_nowait()
        data = json.loads(msg)
        assert data["active_poll_index"] == 1
        assert data["active_poll"]["id"] == q2_id
        assert data["active_poll"]["question"] == "Question 2"
    finally:
        broadcaster.unsubscribe(pres_id, queue)
