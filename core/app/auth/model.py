"""auth 도메인 ORM — User + UserSession (HttpSession 스타일 DB 세션)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# GitHub 식별자(github_id)를 진실원으로 둠. login은 사용자가 GitHub에서 바꿀 수 있으니 캐시.
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    login: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 1유저=1앱 — 첫 배포 시 결정되어 fix. 서브도메인이라 unique. None이면 아직 배포 안 함.
    app_name: Mapped[str | None] = mapped_column(
        String(50), nullable=True, unique=True
    )
    # 커스텀 도메인 (유저가 자기 도메인을 앱에 연결 — CF for SaaS custom hostname).
    # 1유저=1앱이라 도메인도 1개 → 별도 테이블 없이 User에 직접. None이면 미설정.
    custom_domain: Mapped[str | None] = mapped_column(
        String(253), nullable=True, unique=True  # 253 = DNS 호스트네임 최대 길이
    )
    # CF 검증 상태: "pending"(DCV/cert 발급 중) | "active". None이면 도메인 미설정.
    custom_domain_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # 등급: "user"(기본) | "admin"(관리자 페이지) | "root"(소유자 — 등급 변경 가능).
    # root는 코드에 하드코딩 안 함 — 운영자가 DB에서 직접 지정(재시작에도 안 덮어씀).
    # admin은 root가 /admin에서 부여.
    role: Mapped[str] = mapped_column(String(10), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )


# 세션 ID 자체가 secrets.token_urlsafe(48) (64자) — cookie에 그대로 담기고 DB lookup으로 검증.
# JWT 안 씀 — DB가 진실원이라 revoke가 즉시 반영됨.
class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    __table_args__ = (Index("ix_sessions_user_expires", "user_id", "expires_at"),)
