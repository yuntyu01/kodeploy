"""FastAPI 진입점. 도메인 라우터를 등록하고 시작 시 DB 스키마를 보장한다."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS
from app.deploy.router import router as deploy_router
from app.shared.db import Base, engine


# 부팅 시 DB 테이블 자동 생성 (Alembic 도입 전 임시)
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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

app.include_router(deploy_router)


# K8s liveness/readiness probe 엔드포인트
@app.get("/healthz")
def healthz():
    return {"status": "ok"}
