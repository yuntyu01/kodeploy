"""deploy 도메인 ORM."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, Uuid
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app import config
from app.shared.db import Base


# 배포 1건의 영속 상태
class Build(Base):
    __tablename__ = "builds"

    build_id: Mapped[str] = mapped_column(String(8), primary_key=True)
    repo_url: Mapped[str] = mapped_column(String(500))
    branch: Mapped[str] = mapped_column(String(100))
    image: Mapped[str] = mapped_column(String(500))
    app_name: Mapped[str] = mapped_column(String(50))
    port: Mapped[int] = mapped_column(Integer)
    runtime: Mapped[str] = mapped_column(String(20))     # 유저가 선택한 런타임 (python/java) — 스키마가 검증
    db_type: Mapped[str] = mapped_column(String(20), default="none")  # "none" | "mysql" | "postgres"
    use_redis: Mapped[bool] = mapped_column(Boolean, default=False)
    use_storage: Mapped[bool] = mapped_column(Boolean, default=False)  # R2 오브젝트 스토리지(앱당 버킷) 토글
    kind: Mapped[str] = mapped_column(String(20), default="build")  # "build"=일반 빌드 / "env_change"=환경변수 변경 이벤트
    build_mode: Mapped[str] = mapped_column(String(20), default="dockerfile")  # "dockerfile" | "auto"(nixpacks) | "static"(runtime=static이면 서버가 강제)
    dockerfile_path: Mapped[str] = mapped_column(String(200), default="Dockerfile")  # dockerfile 모드 — BuildKit filename
    project_path: Mapped[str] = mapped_column(String(200), default="")  # auto/static 모드 — repo root 기준 서브디렉토리 (빈 값=root)
    build_cmd: Mapped[str] = mapped_column(String(300), default="")  # static 전용 — node 빌드 스테이지 커맨드. 빈 값=빌드 없이 repo 그대로 서빙
    output_dir: Mapped[str] = mapped_column(String(200), default="")  # static 전용 — 빌드 산출물 디렉토리 (예: "dist"). build_cmd 없으면 무시
    # static 전용 — 빌드 타임 변수 JSON (VITE_* 등). 번들에 박혀 공개되는 값이라 Secret 아님.
    # 서버 런타임 env({app}-env Secret)와 별개 — 섞으면 서버 시크릿이 번들에 구워지는 사고가 됨.
    build_env: Mapped[str | None] = mapped_column(Text, nullable=True)
    dockerfile_content: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)  # 실제 빌드에 쓰인 Dockerfile 텍스트. UI 노출 + AI 분석용
    status: Mapped[str] = mapped_column(String(20), default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    # timezone-aware UTC 저장 — Pydantic이 응답 시 timezone offset 포함 ISO 출력 (B 컨벤션)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # tenant_id: user_id에서 파생되는 ns 이름. None이면 default ns로 fallback.
    # 컬럼이 아닌 property — user_id 진실원, 파생값 중복 저장 X.
    @property
    def tenant_id(self) -> str:
        if self.user_id is None:
            return config.DEFAULT_TENANT_NS
        return f"tenant-{self.user_id.hex[:8]}"

    # 라벨/이름에 박을 user_id 문자열. None은 "anonymous".
    @property
    def user_id_str(self) -> str:
        return self.user_id.hex if self.user_id else "anonymous"


# 빌드 행위의 영구 기록 (운영 분석용, append-only).
# builds 테이블은 delete_app 시 통째로 삭제되는 유저 대면 히스토리지만,
# 이 테이블은 의도적으로 안 지움 — "누가 언제 몇 번째 빌드를 얼마나 걸려 돌렸나"가
# 앱 삭제 후에도 남는다. API 미노출 — 운영자가 플랫폼 DB에서 직접 조회.
class BuildRecord(Base):
    __tablename__ = "build_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    build_id: Mapped[str] = mapped_column(String(8))     # builds row와 느슨한 연결 (FK 아님 — builds는 삭제될 수 있음)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    seq: Mapped[int] = mapped_column(Integer)            # 그 유저의 N번째 빌드 (1부터, 이 테이블 카운트 기준 — 앱 삭제에도 이어짐)
    app_name: Mapped[str] = mapped_column(String(50))
    runtime: Mapped[str] = mapped_column(String(20))
    build_mode: Mapped[str] = mapped_column(String(20))  # "dockerfile" | "auto"
    started_at: Mapped[datetime] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 단계별 소요시간 — 빌드 Pod 컨테이너 종료 정보(terminated.startedAt/finishedAt)에서 추출.
    # nixpacks는 auto 모드의 init container라 dockerfile 모드면 None.
    # 컨테이너가 비정상 종료/타임아웃으로 안 끝났으면 None (best-effort).
    nixpacks_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    buildkit_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)  # 시작→종료 전체 (배포/rollout 대기 포함)
    status: Mapped[str] = mapped_column(String(20), default="building")  # 최종: "running" | "failed" | "cancelled"
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
