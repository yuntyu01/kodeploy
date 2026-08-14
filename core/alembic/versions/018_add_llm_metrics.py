"""build_records에 AI 진단 호출 계측 추가 — 모델·결말·토큰·레이턴시·범주.

왜 카운터(Prometheus)가 아니라 컬럼인가:
  진단은 **실패한 빌드에서만** 도는 저빈도 이벤트다. rate() 윈도우 안에 샘플이 0~1개면
  그래프가 의미를 못 만들고, 무엇보다 카운터는 "어떤 빌드가 왜"를 전부 버린다. 범주 분포와
  개별 호출 맥락이 진단 품질 튜닝의 재료인데 그건 라벨 카디널리티로 못 넣는다.
  이 테이블은 이미 append-only 운영 기록이고 빌드 1건 = 1행이라 진단 1회와 정확히 대응한다.

왜 builds.ai_analysis(JSON)에서 파싱하지 않는가:
  builds는 delete_app에서 통째로 삭제된다. 진단 품질 신호는 앱이 지워진 뒤에도 남아야 하므로
  집계 축(cause_category·inconsistent)만 이 영구 테이블로 승격한다. 유저 대면 전문(cause·
  evidence·fix_steps)은 그대로 builds.ai_analysis에 둔다 — 중복 저장 아님, 역할이 다르다.

비용 컬럼을 두지 않는 이유:
  BuildRecord의 기존 원칙과 같다 — 원본만 저장하고 파생은 쿼리에서 뺀다. 비용은
  토큰 × 단가고, 단가는 모델·시점에 따라 바뀐다. 그래서 llm_model을 같이 저장해
  모델을 갈아탄 뒤에도 구간별로 다른 단가를 적용할 수 있게 한다.

started_at 인덱스를 같이 추가하는 이유:
  Grafana 패널이 전부 $__timeFilter(started_at)로 들어오고, admin의 빌드 기록 목록도
  ORDER BY started_at DESC LIMIT이다. 지금은 풀스캔이 싸지만 두 경로 다 이 컬럼을 탄다.

Revision ID: 018
Revises: 017
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 진단을 호출하지 않은 빌드(성공했거나 AI_DIAGNOSE=false)는 전부 NULL —
# "호출했는데 실패"와 "애초에 안 불렀다"를 llm_outcome IS NULL로 구분한다.
#
# 상수 튜플이 아니라 함수인 이유: op.add_column은 넘겨받은 Column을 내부 Table에 귀속시킨다.
# 모듈 레벨 객체를 재사용하면 같은 프로세스에서 두 번째 호출이 "이미 다른 Table 소속"으로 깨진다.
def _columns() -> list[sa.Column]:
    return [
        # 호출 시점의 config.LLM_MODEL. 모델 교체 전후를 갈라 봐야 비용·품질 비교가 성립한다.
        sa.Column("llm_model", sa.String(60), nullable=True),
        # ok | length | refusal | parse_error | api_error
        # length = max_tokens에서 JSON이 잘려 진단이 조용히 빈 경우. 이 값을 세려고 만든 컬럼이다.
        sa.Column("llm_outcome", sa.String(20), nullable=True),
        sa.Column("llm_prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("llm_completion_tokens", sa.Integer(), nullable=True),
        # 게이트웨이 왕복 실측(ms). 실패 호출도 기록 — 타임아웃/에러의 소요시간이 곧 신호다.
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
        # Diagnosis.cause_category (폐쇄집합). outcome != "ok"면 NULL.
        sa.Column("llm_cause_category", sa.String(30), nullable=True),
        # cause_category ↔ kodeploy_specific 자기모순 — 골든셋 없이 재는 유일한 품질 신호.
        sa.Column("llm_inconsistent", sa.Boolean(), nullable=True),
    ]


def upgrade() -> None:
    for column in _columns():
        op.add_column("build_records", column)
    op.create_index("ix_build_records_started_at", "build_records", ["started_at"])


def downgrade() -> None:
    op.drop_index("ix_build_records_started_at", table_name="build_records")
    for column in reversed(_columns()):
        op.drop_column("build_records", column.name)
