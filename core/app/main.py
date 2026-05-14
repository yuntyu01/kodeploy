"""FastAPI 진입점. 도메인 라우터를 등록하고 시작 시 DB 스키마를 보장한다."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.deploy.router import router as deploy_router
from app.shared.db import Base, engine


# 부팅 시 DB 테이블 자동 생성 (Alembic 도입 전 임시)
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="KoDeploy", lifespan=lifespan)
app.include_router(deploy_router)


# K8s liveness/readiness probe 엔드포인트
@app.get("/healthz")
def healthz():
    return {"status": "ok"}
