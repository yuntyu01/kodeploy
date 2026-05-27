"""add use_redis column to builds.

Revision ID: 003
Revises: 002
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("use_redis", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("builds", "use_redis")
