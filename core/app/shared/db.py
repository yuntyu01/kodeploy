"""SQLAlchemy 엔진/세션/Base 정의."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ORM 모델 부모
class Base(DeclarativeBase):
    pass


# FastAPI Depends에 주입할 요청 스코프 세션
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
