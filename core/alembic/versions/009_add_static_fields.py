"""add builds.build_cmd / builds.output_dir — static 런타임 빌드 입력.

static 런타임은 플랫폼이 Dockerfile을 생성(node 빌드 스테이지 → nginx 서빙 스테이지)
하므로, 유저 입력은 빌드 커맨드와 산출물 디렉토리 두 개가 전부다.
기존 row는 NULL — 코드에서 `or ""` 처리 (python/java 빌드에는 의미 없는 컬럼).

Revision ID: 009
Revises: 008
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("build_cmd", sa.String(300), nullable=True))
    op.add_column("builds", sa.Column("output_dir", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("builds", "output_dir")
    op.drop_column("builds", "build_cmd")
