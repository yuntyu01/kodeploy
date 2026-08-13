"""builds.analysis 분리 — env 변경 요약(env_change_summary)과 AI 진단(ai_analysis).

analysis는 컬럼 이름과 실제 의미가 어긋난 채로 굴러왔다. 이름은 "분석"인데 담긴 값은
env_put이 만드는 kind="env_change" row의 변경 키 목록("KEY (추가), KEY2 (수정)")뿐이고,
일반 빌드 row에서는 언제나 NULL이었다. 프론트도 isEnvChange 분기 안에서만 읽는다.

여기에 AI 실패 진단을 얹으면 한 컬럼이 kind에 따라 두 의미를 갖게 되므로, 이름을 실제
의미에 맞추고(analysis → env_change_summary) 진단은 별도 컬럼(ai_analysis)으로 받는다.
rename이라 기존 값은 무손실 이관된다.

Revision ID: 017
Revises: 016
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # MySQL의 CHANGE COLUMN은 타입을 다시 요구한다 — existing_* 로 현재 정의를 그대로 전달.
    op.alter_column(
        "builds",
        "analysis",
        new_column_name="env_change_summary",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
    # 빌드/배포 실패 진단 결과(JSON 문자열). 미실패·기능 OFF면 NULL.
    op.add_column("builds", sa.Column("ai_analysis", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("builds", "ai_analysis")
    op.alter_column(
        "builds",
        "env_change_summary",
        new_column_name="analysis",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
