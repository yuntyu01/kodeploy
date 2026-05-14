"""deploy 도메인 입출력 스키마."""

from datetime import datetime

from pydantic import BaseModel, HttpUrl


# POST /deploy 요청 입력
class DeployRequest(BaseModel):
    repo_url: HttpUrl
    branch: str = "main"
    port: int = 80


# POST /deploy 직후 응답 (build_id 반환)
class DeployResponse(BaseModel):
    build_id: str
    status: str
    image: str
    app_name: str


# GET /deploy 상태 조회 응답
class StatusResponse(BaseModel):
    build_id: str
    status: str
    image: str
    app_name: str
    error: str | None = None
    analysis: str | None = None
    logs: str | None = None
    created_at: datetime
    updated_at: datetime
