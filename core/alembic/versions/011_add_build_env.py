"""add builds.build_env — static 빌드 타임 변수 (JSON).

VITE_* 같은 값은 빌드 중 번들에 박혀 브라우저에 공개되므로 Secret이 아니라
빌드 입력(build_cmd/output_dir과 같은 클래스)이다. 생성 Dockerfile의 build
스테이지에 ENV 줄로 렌더되고, 재배포 폼 prefill을 위해 row에 보존한다.

Revision ID: 011
Revises: 010
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("build_env", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("builds", "build_env")
