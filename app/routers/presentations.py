import asyncio
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.broadcaster import broadcaster
from app.db import get_db
from app.models import Option, Poll, Presentation, PresentationParticipant, Vote
from app.routers.polls import _compute_poll_results
from app.schemas import (
    LeaderboardEntryRead,
    OptionRead,
    ParticipantJoin,
    PollRead,
    PresentationCreate,
    PresentationCreatedRead,
    PresentationRead,
    PresentationStateRead,
)

router = APIRouter(prefix="/presentations", tags=["presentations"])


def _compute_leaderboard(presentation: Presentation, db: Session) -> list[LeaderboardEntryRead]:
    participants = db.scalars(
        select(PresentationParticipant).where(
            PresentationParticipant.presentation_id == presentation.id
        )
    ).all()

    token_to_nickname: dict[str, str] = {
        p.voter_token: p.nickname for p in participants
    }

    poll_ids = [p.id for p in presentation.polls]
    if not poll_ids:
        return []

    stmt = (
        select(Vote, Option.is_correct)
        .join(Option, Vote.option_id == Option.id)
        .where(Vote.poll_id.in_(poll_ids))
    )
    vote_rows = db.execute(stmt).all()

    user_stats: dict[str, dict] = {}

    for p in participants:
        user_stats[p.voter_token] = {
            "correct_count": 0,
            "nickname": p.nickname,
            "voter_token": p.voter_token,
            "earliest_time": p.created_at,
        }

    for vote, is_correct in vote_rows:
        token = vote.voter_token
        if token not in user_stats:
            user_stats[token] = {
                "correct_count": 0,
                "nickname": vote.nickname or token_to_nickname.get(token) or f"Player {token[:4]}",
                "voter_token": token,
                "earliest_time": vote.created_at,
            }
        elif vote.nickname and not user_stats[token]["nickname"]:
            user_stats[token]["nickname"] = vote.nickname

        if is_correct:
            user_stats[token]["correct_count"] += 1
            if vote.created_at < user_stats[token]["earliest_time"]:
                user_stats[token]["earliest_time"] = vote.created_at

    sorted_users = sorted(
        user_stats.values(),
        key=lambda u: (-u["correct_count"], u["earliest_time"]),
    )

    total_questions = len(presentation.polls)
    leaderboard: list[LeaderboardEntryRead] = []
    for rank_idx, u in enumerate(sorted_users, start=1):
        leaderboard.append(
            LeaderboardEntryRead(
                rank=rank_idx,
                nickname=u["nickname"],
                score=u["correct_count"] * 1000,
                correct_count=u["correct_count"],
                total_questions=total_questions,
                voter_token=u["voter_token"],
            )
        )
    return leaderboard


def _build_presentation_state(presentation: Presentation, db: Session) -> PresentationStateRead:
    ordered_polls = sorted(presentation.polls, key=lambda p: p.position)
    total_polls = len(ordered_polls)
    active_poll = None
    results = None

    if 0 <= presentation.active_poll_index < total_polls:
        active_poll_model = ordered_polls[presentation.active_poll_index]
        active_poll = PollRead.model_validate(active_poll_model)
        results = _compute_poll_results(active_poll_model, db)

    participants_count = db.scalar(
        select(func.count(PresentationParticipant.id)).where(
            PresentationParticipant.presentation_id == presentation.id
        )
    ) or 0

    leaderboard = _compute_leaderboard(presentation, db)

    return PresentationStateRead(
        presentation_id=presentation.id,
        title=presentation.title,
        join_code=presentation.join_code,
        active_poll_index=presentation.active_poll_index,
        total_polls=total_polls,
        is_finished=presentation.is_finished,
        participants_count=max(participants_count, len(leaderboard)),
        active_poll=active_poll,
        results=results,
        leaderboard=leaderboard,
    )


@router.post(
    "",
    response_model=PresentationCreatedRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new presentation deck with multiple questions",
)
def create_presentation(payload: PresentationCreate, db: Session = Depends(get_db)):
    presentation = Presentation(
        title=payload.title,
    )
    db.add(presentation)
    db.flush()

    for idx, poll_in in enumerate(payload.polls):
        poll = Poll(
            presentation_id=presentation.id,
            position=idx,
            question=poll_in.question,
            closes_at=poll_in.closes_at,
        )
        db.add(poll)
        db.flush()

        for opt_idx, opt_text in enumerate(poll_in.options):
            is_corr = poll_in.correct_option_index is not None and opt_idx == poll_in.correct_option_index
            option = Option(
                poll_id=poll.id,
                text=opt_text,
                position=opt_idx,
                is_correct=is_corr,
            )
            db.add(option)

    db.commit()

    # Re-fetch with relationships loaded
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation.id)
    )
    return db.scalar(stmt)


@router.post(
    "/{presentation_id}/join",
    response_model=PresentationStateRead,
    summary="Join a presentation as a named participant",
)
def join_presentation(
    presentation_id: uuid.UUID,
    payload: ParticipantJoin,
    db: Session = Depends(get_db),
):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation_id)
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation not found",
        )

    part_stmt = select(PresentationParticipant).where(
        PresentationParticipant.presentation_id == presentation.id,
        PresentationParticipant.voter_token == payload.voter_token,
    )
    participant = db.scalar(part_stmt)
    if not participant:
        participant = PresentationParticipant(
            presentation_id=presentation.id,
            voter_token=payload.voter_token,
            nickname=payload.nickname,
        )
        db.add(participant)
    else:
        participant.nickname = payload.nickname

    db.commit()

    state = _build_presentation_state(presentation, db)
    broadcaster.broadcast(presentation.id, state.model_dump_json())
    return state


@router.post(
    "/code/{join_code}/join",
    response_model=PresentationStateRead,
    summary="Join a presentation by room code as a named participant",
)
def join_presentation_by_code(
    join_code: str,
    payload: ParticipantJoin,
    db: Session = Depends(get_db),
):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.join_code == join_code.strip())
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation room code not found",
        )
    return join_presentation(presentation.id, payload, db)



@router.get(
    "/code/{join_code}",
    response_model=PresentationStateRead,
    summary="Look up a live presentation by its 6-digit room code",
)
def get_presentation_by_code(join_code: str, db: Session = Depends(get_db)):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.join_code == join_code.strip())
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation room code not found",
        )
    return _build_presentation_state(presentation, db)


@router.get(
    "/{presentation_id}",
    response_model=PresentationStateRead,
    summary="Get current state of a presentation",
)
def get_presentation(presentation_id: uuid.UUID, db: Session = Depends(get_db)):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation_id)
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation not found",
        )
    return _build_presentation_state(presentation, db)


@router.post(
    "/{presentation_id}/next",
    response_model=PresentationStateRead,
    summary="Advance to next slide in presentation",
)
def advance_slide(
    presentation_id: uuid.UUID,
    x_admin_key: uuid.UUID | None = Header(None, alias="X-Admin-Key"),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation_id)
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation not found",
        )

    if x_admin_key is None or x_admin_key != presentation.admin_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin key",
        )

    total_polls = len(presentation.polls)
    if presentation.active_poll_index < total_polls - 1:
        presentation.active_poll_index += 1
    else:
        presentation.is_finished = True

    db.commit()
    db.refresh(presentation)

    state = _build_presentation_state(presentation, db)
    broadcaster.broadcast(presentation.id, state.model_dump_json())
    return state


@router.post(
    "/{presentation_id}/prev",
    response_model=PresentationStateRead,
    summary="Go back to previous slide in presentation",
)
def previous_slide(
    presentation_id: uuid.UUID,
    x_admin_key: uuid.UUID | None = Header(None, alias="X-Admin-Key"),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation_id)
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation not found",
        )

    if x_admin_key is None or x_admin_key != presentation.admin_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin key",
        )

    if presentation.is_finished:
        presentation.is_finished = False
    elif presentation.active_poll_index > 0:
        presentation.active_poll_index -= 1

    db.commit()
    db.refresh(presentation)

    state = _build_presentation_state(presentation, db)
    broadcaster.broadcast(presentation.id, state.model_dump_json())
    return state


@router.get(
    "/{presentation_id}/stream",
    summary="Live SSE stream for real-time presentation synchronization",
)
async def stream_presentation(
    presentation_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    stmt = (
        select(Presentation)
        .options(selectinload(Presentation.polls).selectinload(Poll.options))
        .where(Presentation.id == presentation_id)
    )
    presentation = db.scalar(stmt)
    if presentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Presentation not found",
        )

    initial_state = _build_presentation_state(presentation, db)
    initial_payload = initial_state.model_dump_json()

    queue = broadcaster.subscribe(presentation_id)

    async def event_generator():
        try:
            yield f"data: {initial_payload}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            broadcaster.unsubscribe(presentation_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
