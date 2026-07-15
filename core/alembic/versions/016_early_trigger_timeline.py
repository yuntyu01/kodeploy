"""build_records: 파생 push_exposed_seconds → 원본 시각(job_ended_at 등)으로 재설계.

원칙: 원본 "시각"만 저장하고 구간(duration)은 쿼리/뷰에서 뺀다. 015가 저장하던 파생 구간
push_exposed_seconds를 버리고, 그 원본인 job_ended_at을 저장한다(노출시간 = job_ended_at − push_done_at).
함께 deploy_started_at / deploy_ready_at(사용자 체감 = deploy_ready_at − started_at)과 A/B 축
triggered_early를 추가한다.

★ 015는 이미 실 DB에 적용됐으므로 in-place 수정 대신 016으로 전진 마이그레이션한다(적용된 리비전을
  고쳐도 재실행되지 않는 함정 회피). 기존 push_exposed_seconds 값은 버리지 않고 job_ended_at으로
  무손실 이관한다: job_ended_at = push_done_at + push_exposed_seconds. (둘 다 있을 때만.)

Revision ID: 016
Revises: 015
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "build_records", sa.Column("job_ended_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "build_records", sa.Column("deploy_started_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "build_records", sa.Column("deploy_ready_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "build_records", sa.Column("triggered_early", sa.Boolean(), nullable=True)
    )
    # 파생 구간을 원본 시각으로 이관 후 드롭 — 노출시간이 데이터에서 사라지지 않게.
    op.execute(
        "UPDATE build_records "
        "SET job_ended_at = push_done_at "
        "  + INTERVAL FLOOR(push_exposed_seconds * 1000000) MICROSECOND "
        "WHERE push_done_at IS NOT NULL AND push_exposed_seconds IS NOT NULL"
    )
    op.drop_column("build_records", "push_exposed_seconds")


def downgrade() -> None:
    op.add_column(
        "build_records", sa.Column("push_exposed_seconds", sa.Float(), nullable=True)
    )
    # 역이관 — job_ended_at − push_done_at을 초로 복원.
    op.execute(
        "UPDATE build_records "
        "SET push_exposed_seconds = "
        "  TIMESTAMPDIFF(MICROSECOND, push_done_at, job_ended_at) / 1000000 "
        "WHERE push_done_at IS NOT NULL AND job_ended_at IS NOT NULL"
    )
    op.drop_column("build_records", "triggered_early")
    op.drop_column("build_records", "deploy_ready_at")
    op.drop_column("build_records", "deploy_started_at")
    op.drop_column("build_records", "job_ended_at")
