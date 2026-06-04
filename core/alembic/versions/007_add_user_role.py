"""add users.role — 등급(user/admin/root). 전원 default "user".

root는 코드/마이그레이션에 하드코딩하지 않는다 — 운영자가 DB에서 직접 지정:
    UPDATE users SET role = 'root' WHERE login = '<owner>';
(코드에 박으면 나중에 DB에서 바꿔도 재시작/재로그인 때 되돌아가 고정됨)

Revision ID: 007
Revises: 006
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(10), nullable=False, server_default="user"),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
