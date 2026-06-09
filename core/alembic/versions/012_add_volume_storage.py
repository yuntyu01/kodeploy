"""add builds.volume_* — 로컬 영속 볼륨(PVC) 옵션.

영속 저장소는 런타임 무관 공통 옵션 — "none"(ephemeral) | "local"(PVC) | "object"(R2).
object는 기존 use_storage(R2) 컬럼이 담당하고, 여기서 추가하는 컬럼은 local 전용:
- volume_mount_path : PVC를 마운트할 절대경로 (예: /var/www/html/data). 비어 있으면 로컬 볼륨 비활성.
- volume_storage_class : 동적 프로비저너 이름 (기본 local-path).
- volume_size : 요청 용량 (기본 5Gi).

기존 row는 NULL — 코드에서 `or` 기본값 coalesce (build_cmd/output_dir과 동일 컨벤션).

Revision ID: 012
Revises: 011
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("volume_mount_path", sa.String(200), nullable=True))
    op.add_column("builds", sa.Column("volume_storage_class", sa.String(64), nullable=True))
    op.add_column("builds", sa.Column("volume_size", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("builds", "volume_size")
    op.drop_column("builds", "volume_storage_class")
    op.drop_column("builds", "volume_mount_path")
