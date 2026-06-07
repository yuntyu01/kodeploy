"""add users.site_enabled — 정적 사이트 슬롯 선언 (두 슬롯 모델).

배포 제출의 정적 토글값이 저장되는 desired state. 라우팅 규칙
({app} vs {app}-api 호스트 분배, 커스텀 도메인 타깃)의 진실원.

Revision ID: 010
Revises: 009
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("site_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("users", "site_enabled")
