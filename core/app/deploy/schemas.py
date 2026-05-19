"""deploy 도메인 입출력 스키마."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl


# 사용자 선택 가능한 런타임 (runtimes.SELECTABLE_RUNTIMES와 손으로 동기화)
Runtime = Literal["python", "java"]


# POST /deploy 요청 입력
class DeployRequest(BaseModel):
    repo_url: HttpUrl
    branch: str = "main"
    port: int = 80
    runtime: Runtime                                     # 자동 감지 X — 유저가 명시적으로 선택
    name: str | None = None                              # K8s 리소스 이름 + 서브도메인. None이면 서버가 app-<hex8> 자동 생성


# POST /deploy 직후 응답 (build_id 반환)
class DeployResponse(BaseModel):
    build_id: str
    status: str
    repo_url: str
    app_name: str
    runtime: str


# GET /deploy 상태 조회 응답
class StatusResponse(BaseModel):
    build_id: str
    status: str
    repo_url: str
    app_name: str
    runtime: str
    error: str | None = None
    analysis: str | None = None
    logs: str | None = None
    created_at: datetime
    updated_at: datetime
