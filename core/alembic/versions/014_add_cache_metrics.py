"""add build_records.cache_cold, cache_export_failed — early-trigger + registry cache 계측.

cache_cold: 로그에 import 캐시 히트("importing cache manifest")가 없음 = clean 빌드. 캐시 OFF면 NULL.
cache_export_failed: early-trigger로 배포는 성공했으나 뒤따르던 cache export(Job)가 실패/deadline.
  이미지는 이미 push됐으니 배포는 유효 — build.status는 안 건드리고 이 지표로만 남긴다. 캐시 OFF면 NULL.

Revision ID: 014
Revises: 013
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "build_records", sa.Column("cache_cold", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "build_records", sa.Column("cache_export_failed", sa.Boolean(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("build_records", "cache_export_failed")
    op.drop_column("build_records", "cache_cold")
