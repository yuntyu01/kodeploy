"""add custom_domain + custom_domain_status to users (CF for SaaS 커스텀 도메인).

Revision ID: 005
Revises: 004
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("custom_domain", sa.String(253), nullable=True))
    op.add_column("users", sa.Column("custom_domain_status", sa.String(20), nullable=True))
    # 두 유저가 같은 도메인 클레임 못 하게 (nullable이라 MySQL은 NULL 중복 허용).
    op.create_unique_constraint("uq_users_custom_domain", "users", ["custom_domain"])


def downgrade() -> None:
    op.drop_constraint("uq_users_custom_domain", "users", type_="unique")
    op.drop_column("users", "custom_domain_status")
    op.drop_column("users", "custom_domain")
