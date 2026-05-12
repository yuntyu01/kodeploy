"""FastAPI 진입점. 도메인 라우터를 등록하고 시작 시 DB 스키마를 보장한다."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.deploy.router import router as deploy_router
from app.items.router import router as items_router
from app.shared.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 마이그레이션 도구(Alembic 등)가 아직 없어서 부팅 시 테이블을 자동 생성한다.
    # 운영 단계로 가면 Alembic으로 옮길 것.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="KoDeploy", lifespan=lifespan)
app.include_router(deploy_router)
app.include_router(items_router)


@app.get("/healthz")
def healthz():
    # K8s liveness/readiness probe용 최소 엔드포인트.
    return {"status": "ok"}
