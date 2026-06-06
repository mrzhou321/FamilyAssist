"""add recommendation events

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


memory_domain = postgresql.ENUM("dressing", "diet", "exercise", "general", name="memory_domain", create_type=False)


def upgrade() -> None:
    op.create_table(
        "recommendation_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("domain", memory_domain, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("memory_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("basis", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_recommendation_events_member_created", "recommendation_events", ["member_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_recommendation_events_member_created", table_name="recommendation_events")
    op.drop_table("recommendation_events")
