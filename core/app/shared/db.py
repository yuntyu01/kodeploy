"""SQLAlchemy 엔진/세션/Base 정의. 도메인 모델은 모두 Base를 상속한다."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

# pool_pre_ping: 풀에서 꺼낸 커넥션이 살아있는지 매번 가벼운 ping으로 확인.
# MySQL이 idle 커넥션을 끊는 경우(wait_timeout) 첫 쿼리에서 끊긴 커넥션을 받는 사고를 막아준다.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    # SQLAlchemy 2.0 스타일의 선언적 베이스. 모든 ORM 모델의 부모.
    pass


def get_db():
    # FastAPI Depends 패턴: 요청마다 세션을 만들고 응답 후 close.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
