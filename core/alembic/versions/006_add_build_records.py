"""add build_records — 빌드 행위 영구 기록 (운영 분석용 append-only).

Revision ID: 006
Revises: 005
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "build_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("build_id", sa.String(8), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("app_name", sa.String(50), nullable=False),
        sa.Column("runtime", sa.String(20), nullable=False),
        sa.Column("build_mode", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("nixpacks_seconds", sa.Float(), nullable=True),
        sa.Column("buildkit_seconds", sa.Float(), nullable=True),
        sa.Column("total_seconds", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="building"),
        sa.Column("error", sa.Text(), nullable=True),
    )
    # 유저별 빌드 기록 조회 + seq 계산(count)용
    op.create_index("ix_build_records_user_id", "build_records", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_build_records_user_id", table_name="build_records")
    op.drop_table("build_records")
