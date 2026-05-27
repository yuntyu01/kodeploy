"""drop deprecated use_db column from builds.

Revision ID: 002
Revises: 001
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='builds' AND column_name='use_db'"
    ))
    if result.fetchone():
        op.drop_column("builds", "use_db")


def downgrade() -> None:
    op.add_column("builds", sa.Column("use_db", sa.Boolean(), nullable=False, server_default="0"))
