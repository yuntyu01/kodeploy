"""add build_records.push_done_at, push_exposed_seconds — early-trigger 노출시간 계측.

push_done_at: 이미지 push 완료(레지스트리에 이미지가 올라간) 시각 = early-trigger가 배포를 트리거하는 지점.
push_exposed_seconds: push 완료 → Job 종료(=cache export 완료)까지 초 = 사용자가 export에 노출된(기다린) 몫.
  = early-trigger가 응답 경로에서 빼는/뺀 시간. 플래그와 무관하게 기록(켜기 전 실측용). 벤치의 15.6초가
  운영에서 실제로 얼마인지를 이 컬럼이 알려준다.

Revision ID: 015
Revises: 014
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "build_records", sa.Column("push_done_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "build_records", sa.Column("push_exposed_seconds", sa.Float(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("build_records", "push_exposed_seconds")
    op.drop_column("build_records", "push_done_at")
