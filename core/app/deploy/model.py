"""deploy 도메인 ORM."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, Uuid
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
    status: Mapped[str] = mapped_column(String(20), default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
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
