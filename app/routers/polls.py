from datetime import datetime, timezone
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.broadcaster import broadcaster
from app.db import get_db
from app.models import Option, Poll, Vote
from app.schemas import (
    OptionResultRead,
    PollCreate,
    PollRead,
    PollResultsRead,
    VoteCreate,
    VoteRead,
)

router = APIRouter(prefix="/polls", tags=["polls"])


def _compute_poll_results(poll: Poll, db: Session) -> PollResultsRead:
    # Decision 3: On-the-fly SQL aggregation using outerjoin to include 0-vote options
    stmt = (
        select(
            Option.id,
            Option.text,
            Option.position,
            func.count(Vote.id).label("vote_count"),
        )
        .outerjoin(Vote, Option.id == Vote.option_id)
        .where(Option.poll_id == poll.id)
        .group_by(Option.id, Option.text, Option.position)
        .order_by(Option.position)
    )
    rows = db.execute(stmt).all()

    option_results = [
        OptionResultRead(
            id=row.id,
            text=row.text,
            position=row.position,
            vote_count=row.vote_count,
        )
        for row in rows
    ]
    total_votes = sum(item.vote_count for item in option_results)

    now = datetime.now(timezone.utc)
    is_expired = False
    if poll.closes_at is not None:
        closing_time = (
            poll.closes_at
            if poll.closes_at.tzinfo
            else poll.closes_at.replace(tzinfo=timezone.utc)
        )
        is_expired = closing_time <= now

    return PollResultsRead(
        poll_id=poll.id,
        question=poll.question,
        is_closed=poll.is_closed or is_expired,
        total_votes=total_votes,
        results=option_results,
    )


@router.post("", response_model=PollRead, status_code=status.HTTP_201_CREATED)
def create_poll(payload: PollCreate, db: Session = Depends(get_db)):
    poll = Poll(
        question=payload.question,
        closes_at=payload.closes_at,
    )

    # Position is 0-indexed to preserve order of submitted options
    for index, option_text in enumerate(payload.options):
        option = Option(
            text=option_text,
            position=index,
        )
        poll.options.append(option)

    db.add(poll)
    db.commit()
    db.refresh(poll)
    return poll


@router.get("/{poll_id}", response_model=PollRead)
def get_poll(poll_id: uuid.UUID, db: Session = Depends(get_db)):
    # selectinload eagerly loads options in a second query to prevent lazy-load overhead
    stmt = (
        select(Poll)
        .options(selectinload(Poll.options))
        .where(Poll.id == poll_id)
    )
    poll = db.scalar(stmt)

    if poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )

    return poll


@router.post("/{poll_id}/votes", response_model=VoteRead, status_code=status.HTTP_201_CREATED)
def cast_vote(
    poll_id: uuid.UUID,
    payload: VoteCreate,
    db: Session = Depends(get_db),
):
    poll = db.scalar(select(Poll).where(Poll.id == poll_id))
    if poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )

    now = datetime.now(timezone.utc)
    is_expired = False
    if poll.closes_at is not None:
        closing_time = (
            poll.closes_at
            if poll.closes_at.tzinfo
            else poll.closes_at.replace(tzinfo=timezone.utc)
        )
        is_expired = closing_time <= now

    if poll.is_closed or is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Poll is closed",
        )

    # Validate that option belongs to this poll
    option = db.scalar(
        select(Option).where(
            Option.id == payload.option_id,
            Option.poll_id == poll_id,
        )
    )
    if option is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid option for this poll",
        )

    vote = Vote(
        poll_id=poll_id,
        option_id=payload.option_id,
        voter_token=payload.voter_token,
    )
    db.add(vote)
    try:
        db.commit()
        db.refresh(vote)
    except IntegrityError:
        # Decision 1 & 2: Database unique constraint enforces one vote per token per poll
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already voted in this poll",
        )

    # Decision 4 & 5: Broadcast updated results to any connected SSE clients
    updated_results = _compute_poll_results(poll, db)
    broadcaster.broadcast(poll_id, updated_results.model_dump_json())

    return vote


@router.get("/{poll_id}/results", response_model=PollResultsRead)
def get_poll_results(poll_id: uuid.UUID, db: Session = Depends(get_db)):
    poll = db.scalar(select(Poll).where(Poll.id == poll_id))
    if poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )

    return _compute_poll_results(poll, db)


@router.get("/{poll_id}/stream")
async def stream_poll_results(
    poll_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    poll = db.scalar(select(Poll).where(Poll.id == poll_id))
    if poll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found",
        )

    # Fetch initial state before entering the long-lived generator.
    # Note: Holding DB sessions during long-lived streams exhausts connection pools!
    initial_data = _compute_poll_results(poll, db).model_dump_json()
    queue = broadcaster.subscribe(poll_id)

    async def event_generator():
        # Immediately send current state on connect
        yield f"data: {initial_data}\n\n"

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for next vote update or send ping heartbeat
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            broadcaster.unsubscribe(poll_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


