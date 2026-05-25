"""deploy 도메인 입출력 스키마."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl


# 사용자 선택 가능한 런타임 (runtimes.SELECTABLE_RUNTIMES와 손으로 동기화)
Runtime = Literal["python", "java"]
BuildMode = Literal["dockerfile", "auto"]                # "auto"는 nixpacks 자동 Dockerfile 생성
DbType = Literal["none", "mysql", "postgres"]            # 한 앱에 한 DB만 — 동시 사용 X


# POST /deploy 요청 입력
class DeployRequest(BaseModel):
    repo_url: HttpUrl
    branch: str = "main"
    port: int = 80
    runtime: Runtime                                     # 자동 감지 X — 유저가 명시적으로 선택
    name: str | None = None                              # K8s 리소스 이름 + 서브도메인. None이면 서버가 app-<hex8> 자동 생성
    use_db: bool = False                                 # deprecated — db_type이 우선. use_db=True + db_type="none"이면 mysql로 추정
    db_type: DbType = "none"                             # "none" | "mysql" | "postgres"
    build_mode: BuildMode = "dockerfile"                 # "dockerfile"=유저 Dockerfile / "auto"=nixpacks 자동 생성
    dockerfile_path: str = "Dockerfile"                  # dockerfile 모드일 때 — "Dockerfile.multi", "subdir/Dockerfile" 등
    project_path: str = ""                               # auto 모드일 때 — 서브디렉토리 (예: "backend"). 빈 값=repo root
    env: dict[str, str] = {}                             # 첫 배포 시 Secret 생성, 재배포면 replace. 빈 dict면 set_env 호출 안 함.


# POST /deploy 직후 응답 (build_id 반환)
class DeployResponse(BaseModel):
    build_id: str
    status: str
    repo_url: str
    app_name: str
    runtime: str


# GET/PUT /deploy/env 입출력 — 전체 dict를 통째로 다룸 (부분 patch 안 함).
class EnvVarsRequest(BaseModel):
    env: dict[str, str]


class EnvVarsResponse(BaseModel):
    env: dict[str, str]


# GET /deploy 상태 조회 응답
class StatusResponse(BaseModel):
    build_id: str
    status: str
    repo_url: str
    branch: str
    app_name: str
    runtime: str
    build_mode: str
    port: int = 80
    db_type: str = "none"                                # "none" | "mysql" | "postgres"
    kind: str = "build"                                  # "build" | "env_change". 옛 row는 기본 "build".
    dockerfile_path: str = "Dockerfile"
    project_path: str = ""
    dockerfile_content: str | None = None                # 실제 빌드에 쓰인 Dockerfile. UI에서 코드 블록으로 표시.
    error: str | None = None
    analysis: str | None = None
    logs: str | None = None
    created_at: datetime
    updated_at: datetime
