"""add users.extra_hostnames — 플랫폼 기능 밖 추가 hostname (운영자가 DB에서 직접 관리).

콤마 구분 텍스트. 커스텀 도메인 기능이 거부하는 apex 등 특수 케이스를
선언적 데이터로 승격 — route reconcile(통째 set)이 이 값을 항상 포함하므로
kubectl 수동 patch처럼 다음 갱신에 증발하지 않는다.
    UPDATE users SET extra_hostnames = 'dailoapp.com' WHERE login = '<owner>';

Revision ID: 008
Revises: 007
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("extra_hostnames", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "extra_hostnames")
