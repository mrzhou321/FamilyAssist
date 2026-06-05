"""empty

Revision ID: 0001
Revises:
Create Date: 2026-06-05
"""

from alembic import op


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    pass
