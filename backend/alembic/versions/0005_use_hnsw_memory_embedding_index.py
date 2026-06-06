"""use hnsw memory embedding index

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-06
"""

from alembic import op


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_memories_embedding_cosine", table_name="memories")
    op.create_index(
        "ix_memories_embedding_cosine",
        "memories",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
        postgresql_with={"m": 16, "ef_construction": 64},
    )


def downgrade() -> None:
    op.drop_index("ix_memories_embedding_cosine", table_name="memories")
    op.create_index(
        "ix_memories_embedding_cosine",
        "memories",
        ["embedding"],
        postgresql_using="ivfflat",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
