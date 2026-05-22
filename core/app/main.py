"""FastAPI 진입점. 도메인 라우터를 등록하고 시작 시 DB 스키마를 보장한다."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.auth.router import router as auth_router
# Base.metadata.create_all이 인식하도록 model 모듈 import (side-effect)
from app.auth import model as _auth_model  # noqa: F401
from app.config import ALLOWED_ORIGINS
from app.deploy.router import router as deploy_router
from app.shared.db import Base, engine


# create_all은 새 테이블만 만들고 기존 테이블에 컬럼 추가 안 함 — 누적 마이그레이션이
# 늘면 Alembic 도입. 지금은 작은 규모라 멱등 ALTER 한 줄씩 시도하는 게 단순.
_COLUMN_MIGRATIONS = [
    "ALTER TABLE builds ADD COLUMN build_mode VARCHAR(20) NOT NULL DEFAULT 'dockerfile'",
    "ALTER TABLE builds ADD COLUMN dockerfile_content LONGTEXT NULL",
    "ALTER TABLE builds ADD COLUMN project_path VARCHAR(200) NOT NULL DEFAULT ''",
    # 1유저=1앱 — 첫 배포 시 결정되는 앱 이름 (서브도메인이라 unique).
    "ALTER TABLE users ADD COLUMN app_name VARCHAR(50) NULL UNIQUE",
]


def _apply_column_migrations() -> None:
    with engine.begin() as conn:
        for sql in _COLUMN_MIGRATIONS:
            try:
                conn.execute(text(sql))
            except Exception as e:
                if "Duplicate column" not in str(e):  # MySQL 에러 메시지
                    raise


# 부팅 시 DB 테이블 자동 생성 + 컬럼 마이그레이션 (Alembic 도입 전 임시)
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _apply_column_migrations()
    yield


app = FastAPI(title="KoDeploy", lifespan=lifespan)

# Cloudflare Pages 등 별도 도메인 프론트에서 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(deploy_router)


# K8s liveness/readiness probe 엔드포인트
@app.get("/healthz")
def healthz():
    return {"status": "ok"}
