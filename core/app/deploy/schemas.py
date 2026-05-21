"""deploy 도메인 입출력 스키마."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl


# 사용자 선택 가능한 런타임 (runtimes.SELECTABLE_RUNTIMES와 손으로 동기화)
Runtime = Literal["python", "java"]
BuildMode = Literal["dockerfile", "auto"]                # "auto"는 nixpacks 자동 Dockerfile 생성


# POST /deploy 요청 입력
class DeployRequest(BaseModel):
    repo_url: HttpUrl
    branch: str = "main"
    port: int = 80
    runtime: Runtime                                     # 자동 감지 X — 유저가 명시적으로 선택
    name: str | None = None                              # K8s 리소스 이름 + 서브도메인. None이면 서버가 app-<hex8> 자동 생성
    use_db: bool = False                                 # True면 같은 ns에 mysql 자동 프로비저닝
    build_mode: BuildMode = "dockerfile"                 # "dockerfile"=유저 Dockerfile / "auto"=nixpacks 자동 생성
    dockerfile_path: str = "Dockerfile"                  # dockerfile 모드일 때 — "Dockerfile.multi", "subdir/Dockerfile" 등
    project_path: str = ""                               # auto 모드일 때 — 서브디렉토리 (예: "backend"). 빈 값=repo root


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
    branch: str
    app_name: str
    runtime: str
    build_mode: str
    dockerfile_content: str | None = None                # 실제 빌드에 쓰인 Dockerfile. UI에서 코드 블록으로 표시.
    error: str | None = None
    analysis: str | None = None
    logs: str | None = None
    created_at: datetime
    updated_at: datetime
