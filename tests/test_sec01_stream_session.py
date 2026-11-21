import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base
import app.routers.polls as polls_router
import app.routers.presentations as pres_router

def test_stream_poll_releases_db_session_before_streaming(monkeypatch):
    """SEC-01: Verify that GET /polls/{id}/stream closes its DB session before entering the event generator."""
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=test_engine)

    session_closed_during_stream = None
    created_sessions = []

    class MonitoredSession(Session):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._is_closed = False
            created_sessions.append(self)

        def close(self):
            self._is_closed = True
            super().close()

    MonitoredSessionLocal = sessionmaker(class_=MonitoredSession, bind=test_engine)
    monkeypatch.setattr(polls_router, "SessionLocal", MonitoredSessionLocal)

    with MonitoredSessionLocal() as db:
        from app.models import Poll, Option
        poll = Poll(id=uuid.uuid4(), question="Test Session Close?")
        opt1 = Option(poll_id=poll.id, text="A", position=0)
        opt2 = Option(poll_id=poll.id, text="B", position=1)
        poll.options.extend([opt1, opt2])
        db.add(poll)
        db.commit()
        poll_id = poll.id

    # Reset tracked sessions
    created_sessions.clear()

    with TestClient(app) as client:
        with client.stream("GET", f"/polls/{poll_id}/stream") as stream_res:
            assert stream_res.status_code == 200
            for line in stream_res.iter_lines():
                if line.startswith("data: "):
                    # At this point, the initial event has been received.
                    # The DB session created for fetching initial data must already be closed!
                    assert len(created_sessions) >= 1
                    session_closed_during_stream = all(s._is_closed for s in created_sessions)
                    break

    assert session_closed_during_stream is True


def test_stream_presentation_releases_db_session_before_streaming(monkeypatch):
    """SEC-01: Verify that GET /presentations/{id}/stream closes its DB session before entering the event generator."""
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=test_engine)

    session_closed_during_stream = None
    created_sessions = []

    class MonitoredSession(Session):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._is_closed = False
            created_sessions.append(self)

        def close(self):
            self._is_closed = True
            super().close()

    MonitoredSessionLocal = sessionmaker(class_=MonitoredSession, bind=test_engine)
    monkeypatch.setattr(pres_router, "SessionLocal", MonitoredSessionLocal)

    with MonitoredSessionLocal() as db:
        from app.models import Presentation, Poll, Option
        pres = Presentation(id=uuid.uuid4(), title="Stream Pres Test", join_code="999999")
        poll = Poll(id=uuid.uuid4(), presentation_id=pres.id, question="Q1", position=0)
        opt1 = Option(poll_id=poll.id, text="A", position=0)
        poll.options.append(opt1)
        pres.polls.append(poll)
        db.add(pres)
        db.commit()
        pres_id = pres.id

    created_sessions.clear()

    with TestClient(app) as client:
        with client.stream("GET", f"/presentations/{pres_id}/stream") as stream_res:
            assert stream_res.status_code == 200
            for line in stream_res.iter_lines():
                if line.startswith("data: "):
                    assert len(created_sessions) >= 1
                    session_closed_during_stream = all(s._is_closed for s in created_sessions)
                    break

    assert session_closed_during_stream is True
