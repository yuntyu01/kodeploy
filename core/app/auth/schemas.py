"""auth 도메인 응답 DTO."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    github_id: int
    login: str
    email: str | None = None
    avatar_url: str | None = None
    app_name: str | None = None                          # 첫 배포 후에만 값 — 클라이언트가 DeployForm name 입력란 분기에 사용
    role: str = "user"                                   # "user" | "admin" | "root" — TopBar 관리자 링크 노출 분기에 사용
    created_at: datetime
