"""items 도메인 ORM. SQLAlchemy/Pydantic 통합 패턴 데모용 샘플."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base


class Item(Base):
    __tablename__ = "items"

    # SQLAlchemy 2.0 typed Mapped 스타일 — 컬럼 타입과 파이썬 타입을 함께 선언.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
