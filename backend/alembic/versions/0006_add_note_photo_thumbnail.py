"""add note photo thumbnail

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notes", sa.Column("photo_thumbnail", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("notes", "photo_thumbnail")
