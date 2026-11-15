from datetime import datetime
import uuid
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closes_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    options: Mapped[list["Option"]] = relationship(
        back_populates="poll",
        cascade="all, delete-orphan",
        order_by="Option.position",
    )
    votes: Mapped[list["Vote"]] = relationship(
        back_populates="poll",
        cascade="all, delete-orphan",
    )


class Option(Base):
    __tablename__ = "options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    poll: Mapped["Poll"] = relationship(back_populates="options")
    votes: Mapped[list["Vote"]] = relationship(
        back_populates="option",
        cascade="all, delete-orphan",
    )


class Vote(Base):
    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    option_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("options.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voter_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    poll: Mapped["Poll"] = relationship(back_populates="votes")
    option: Mapped["Option"] = relationship(back_populates="votes")

    __table_args__ = (
        # Decision 1 & 2: Prevent a participant from voting more than once in the same poll
        UniqueConstraint("poll_id", "voter_token", name="uq_poll_voter"),
    )

