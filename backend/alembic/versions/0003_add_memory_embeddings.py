"""add memory embeddings

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from app.embeddings import EMBEDDING_DIMENSION


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("memories", sa.Column("embedding", Vector(EMBEDDING_DIMENSION), nullable=True))
    op.create_index(
        "ix_memories_embedding_cosine",
        "memories",
        ["embedding"],
        postgresql_using="ivfflat",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_memories_embedding_cosine", table_name="memories")
    op.drop_column("memories", "embedding")
