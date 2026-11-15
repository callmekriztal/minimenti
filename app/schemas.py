from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator


class OptionRead(BaseModel):
    id: int
    text: str
    position: int

    model_config = ConfigDict(from_attributes=True)


class PollCreate(BaseModel):
    question: str = Field(..., description="The poll question")
    options: list[str] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="List of 2 to 10 option texts",
    )
    closes_at: datetime | None = Field(
        default=None,
        description="Optional timestamp when the poll closes",
    )

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Question cannot be empty")
        return trimmed

    @field_validator("options")
    @classmethod
    def validate_options(cls, values: list[str]) -> list[str]:
        if len(values) < 2 or len(values) > 10:
            raise ValueError("A poll must have between 2 and 10 options")

        cleaned: list[str] = []
        for opt in values:
            trimmed = opt.strip()
            if not trimmed:
                raise ValueError("Option text cannot be empty")
            cleaned.append(trimmed)
        return cleaned


class PollRead(BaseModel):
    id: uuid.UUID
    presentation_id: uuid.UUID | None = None
    position: int = 0
    question: str
    created_at: datetime
    closes_at: datetime | None
    is_closed: bool
    options: list[OptionRead]

    model_config = ConfigDict(from_attributes=True)


class PollCreatedRead(PollRead):
    # Decision 6: Secret key returned only to creator upon creation
    admin_key: uuid.UUID


class VoteCreate(BaseModel):
    option_id: int = Field(..., description="ID of the option to vote for")
    voter_token: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Client-generated unique token identifying this browser/device",
    )

    @field_validator("voter_token")
    @classmethod
    def validate_voter_token(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("voter_token cannot be empty")
        return trimmed


class VoteRead(BaseModel):
    id: int
    poll_id: uuid.UUID
    option_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OptionResultRead(BaseModel):
    id: int
    text: str
    position: int
    vote_count: int


class PollResultsRead(BaseModel):
    poll_id: uuid.UUID
    question: str
    is_closed: bool
    total_votes: int
    results: list[OptionResultRead]


class PresentationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Presentation title")
    polls: list[PollCreate] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of poll questions in the presentation",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Title cannot be empty")
        return trimmed


class PresentationRead(BaseModel):
    id: uuid.UUID
    title: str
    join_code: str
    active_poll_index: int
    is_finished: bool
    created_at: datetime
    polls: list[PollRead]

    model_config = ConfigDict(from_attributes=True)


class PresentationCreatedRead(PresentationRead):
    admin_key: uuid.UUID


class PresentationStateRead(BaseModel):
    presentation_id: uuid.UUID
    title: str
    join_code: str
    active_poll_index: int
    total_polls: int
    is_finished: bool
    active_poll: PollRead | None
    results: PollResultsRead | None

