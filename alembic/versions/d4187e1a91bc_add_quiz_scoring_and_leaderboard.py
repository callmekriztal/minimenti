"""add quiz scoring, nickname, and presentation_participants

Revision ID: d4187e1a91bc
Revises: c2356a08bed9
Create Date: 2026-11-15 17:18:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4187e1a91bc'
down_revision: Union[str, Sequence[str], None] = 'c2356a08bed9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_correct to options
    op.add_column('options', sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 2. Add nickname to votes
    op.add_column('votes', sa.Column('nickname', sa.String(length=50), nullable=True))

    # 3. Create presentation_participants table
    op.create_table(
        'presentation_participants',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('presentation_id', sa.Uuid(), nullable=False),
        sa.Column('voter_token', sa.String(length=64), nullable=False),
        sa.Column('nickname', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['presentation_id'], ['presentations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('presentation_id', 'voter_token', name='uq_pres_participant')
    )
    op.create_index(op.f('ix_presentation_participants_presentation_id'), 'presentation_participants', ['presentation_id'], unique=False)
    op.create_index(op.f('ix_presentation_participants_voter_token'), 'presentation_participants', ['voter_token'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_presentation_participants_voter_token'), table_name='presentation_participants')
    op.drop_index(op.f('ix_presentation_participants_presentation_id'), table_name='presentation_participants')
    op.drop_table('presentation_participants')
    op.drop_column('votes', 'nickname')
    op.drop_column('options', 'is_correct')
