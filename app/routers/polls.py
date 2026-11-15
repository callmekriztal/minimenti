import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Option, Poll
from app.schemas import PollCreate, PollRead

router = APIRouter(prefix="/polls", tags=["polls"])


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
