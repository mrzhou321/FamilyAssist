"""create core tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


note_source = postgresql.ENUM("text", "voice", "photo", name="note_source")
memory_type = postgresql.ENUM("fact", "episode", name="memory_type")
memory_domain = postgresql.ENUM("dressing", "diet", "exercise", "general", name="memory_domain")


def upgrade() -> None:
    bind = op.get_bind()
    note_source.create(bind, checkfirst=True)
    memory_type.create(bind, checkfirst=True)
    memory_domain.create(bind, checkfirst=True)

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("birthday", sa.String(length=20), nullable=True),
        sa.Column("relation", sa.String(length=80), nullable=False),
        sa.Column("bound", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("profile", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", note_source, nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="understanding"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notes_member_created", "notes", ["member_id", "created_at"])

    op.create_table(
        "memories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", memory_type, nullable=False),
        sa.Column("domain", memory_domain, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("source_note_id", sa.Integer(), sa.ForeignKey("notes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_memories_member_domain", "memories", ["member_id", "domain"])
    op.create_index("ix_memories_expires_at", "memories", ["expires_at"])

    op.create_table(
        "pairing_tokens",
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_pairing_tokens_member_expires", "pairing_tokens", ["member_id", "expires_at"])

    op.create_table(
        "member_sessions",
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_name", sa.String(length=160), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_member_sessions_member_revoked", "member_sessions", ["member_id", "revoked"])

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=120), primary_key=True),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_index("ix_member_sessions_member_revoked", table_name="member_sessions")
    op.drop_table("member_sessions")
    op.drop_index("ix_pairing_tokens_member_expires", table_name="pairing_tokens")
    op.drop_table("pairing_tokens")
    op.drop_index("ix_memories_expires_at", table_name="memories")
    op.drop_index("ix_memories_member_domain", table_name="memories")
    op.drop_table("memories")
    op.drop_index("ix_notes_member_created", table_name="notes")
    op.drop_table("notes")
    op.drop_table("members")

    bind = op.get_bind()
    memory_domain.drop(bind, checkfirst=True)
    memory_type.drop(bind, checkfirst=True)
    note_source.drop(bind, checkfirst=True)
