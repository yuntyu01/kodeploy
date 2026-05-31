"""add use_storage column to builds (R2 object storage toggle).

Revision ID: 004
Revises: 003
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("use_storage", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("builds", "use_storage")
