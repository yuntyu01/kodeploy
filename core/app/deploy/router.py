from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import asyncio
import uuid

from app.auth.deps import get_current_user
from app.auth.model import User
from app.deploy import env, service
from app.deploy.model import Build
from app.deploy.schemas import (
    DeployRequest,
    DeployResponse,
    EnvVarsRequest,
    EnvVarsResponse,
    StatusResponse,
)
from app.shared.db import get_db

router = APIRouter(prefix="/deploy", tags=["deploy"])


# Build ORM 객체 → StatusResponse 응답 DTO 변환
def _to_status(build: Build) -> StatusResponse:
    return StatusResponse(
        build_id=build.build_id,
        status=build.status,
        repo_url=build.repo_url,
        branch=build.branch,
        app_name=build.app_name,
        runtime=build.runtime,
        build_mode=build.build_mode,
        db_type=build.db_type or "none",
        kind=build.kind or "build",
        dockerfile_content=build.dockerfile_content,
        error=build.error,
        analysis=build.analysis,
        logs=build.logs,
        created_at=build.created_at,
        updated_at=build.updated_at,
    )


# 빌드 트리거 엔드포인트 (즉시 build_id 반환, 빌드는 백그라운드)
@router.post("", response_model=DeployResponse)
async def create_deploy(
    req: DeployRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DeployResponse:
    # db_type 우선 — req.db_type이 명시면 그것. 옛 frontend 호환 위해 use_db=True + db_type="none"이면 mysql로 추정.
    db_type = req.db_type
    if db_type == "none" and req.use_db:
        db_type = "mysql"

    try:
        build = await service.start_build(
            db,
            repo_url=str(req.repo_url),
            runtime=req.runtime,
            user=user,
            name=req.name,
            branch=req.branch,
            port=req.port,
            use_db=db_type != "none",
            db_type=db_type,
            build_mode=req.build_mode,
            dockerfile_path=req.dockerfile_path,
            project_path=req.project_path,
            env_vars=req.env,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return DeployResponse(
        build_id=build.build_id,
        status=build.status,
        repo_url=build.repo_url,
        app_name=build.app_name,
        runtime=build.runtime,
    )


# 사용자 앱의 환경변수 조회. 첫 배포 전이거나 한 번도 설정 안 했으면 빈 dict.
# /{build_id} GET 핸들러보다 위에 등록해야 "env"가 build_id로 잡히지 않음.
@router.get("/env", response_model=EnvVarsResponse)
def env_get(user: User = Depends(get_current_user)) -> EnvVarsResponse:
    if not user.app_name:
        return EnvVarsResponse(env={})
    tenant_id = f"tenant-{user.id.hex[:8]}"
    return EnvVarsResponse(env=env.get_env(tenant_id, user.app_name))


# 환경변수 전체 replace. 저장 직후 rolling update 트리거로 새 값 즉시 반영.
# 빌드 status는 영구 기록이라 안 건드림. 새 Pod 상태는 헤더의 앱 상태(/deploy/app/status)로 표시.
@router.put("/env", response_model=EnvVarsResponse)
async def env_put(
    req: EnvVarsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EnvVarsResponse:
    if not user.app_name:
        raise HTTPException(status_code=400, detail="첫 배포 완료 후 환경변수 설정 가능")
    tenant_id = f"tenant-{user.id.hex[:8]}"
    # 변경 전 현재 env (Secret) 조회 — set_env 전에 받아둬야 diff 계산 가능
    old_env = env.get_env(tenant_id, user.app_name)
    try:
        env.set_env(tenant_id, user.app_name, req.env)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 어떤 키가 바뀌었는지만 기록 (값은 보안상 저장 X). 형식: "KEY (추가), KEY2 (수정), KEY3 (삭제)".
    new_env = req.env
    added = sorted(k for k in new_env if k not in old_env)
    modified = sorted(
        k for k in new_env if k in old_env and new_env[k] != old_env[k]
    )
    removed = sorted(k for k in old_env if k not in new_env)
    entries = (
        [f"{k} (추가)" for k in added]
        + [f"{k} (수정)" for k in modified]
        + [f"{k} (삭제)" for k in removed]
    )
    if not entries:
        # 같은 값 재저장 — 히스토리에 noise 안 남김
        return EnvVarsResponse(env=req.env)

    # 환경변수 변경 이벤트를 히스토리에 기록 — kind="env_change"라 #N 번호 안 매김.
    # 직전 build에서 repo/branch/runtime/image 컨텍스트 복사 (none이면 빈 값).
    latest = (
        db.query(Build).filter_by(user_id=user.id)
        .order_by(Build.created_at.desc()).first()
    )
    event = Build(
        build_id=uuid.uuid4().hex[:8],
        repo_url=latest.repo_url if latest else "",
        branch=latest.branch if latest else "",
        image=latest.image if latest else "",
        app_name=user.app_name,
        port=latest.port if latest else 80,
        runtime=latest.runtime if latest else "",
        user_id=user.id,
        use_db=latest.use_db if latest else False,
        db_type=latest.db_type if latest else "none",
        kind="env_change",
        status="applied",
        analysis=", ".join(entries),  # "KEY (추가), KEY2 (수정), KEY3 (삭제)"
    )
    db.add(event)
    db.commit()

    # Pod이 새 env로 부팅했는지 백그라운드 폴링 → 이 event row의 status를 running/failed로 갱신.
    asyncio.create_task(
        service.watch_env_change_rollout(
            user.id, user.app_name, tenant_id, event.build_id,
        )
    )
    return EnvVarsResponse(env=req.env)


# 현재 user 앱의 Pod 상태 — 빌드와 독립. 프론트가 폴링.
# 응답: {"status": "running" | "pending" | "crashing" | "missing"}
@router.get("/app/status")
def app_status(user: User = Depends(get_current_user)) -> dict:
    return {"status": service.get_app_status(user)}


# 앱 완전 삭제 — K8s 리소스 + PVC + builds + user.app_name 리셋.
# /{build_id} 핸들러보다 위에 등록해야 path param이 "app"을 잡지 않음.
@router.delete("/app")
def delete_app(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        service.delete_app(db, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "deleted"}


# 사용자의 최신 build의 repo+branch에서 GitHub 최근 커밋 N개 조회.
# /{build_id} GET 핸들러보다 위에 등록해야 "commits"가 build_id로 잡히지 않음.
# build가 없거나 repo 파싱 실패 시 빈 리스트. private repo는 unauthenticated 호출 실패라 빈 리스트.
@router.get("/commits")
def list_recent_commits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    builds = service.list_builds(db, user_id=user.id)
    if not builds:
        return []
    latest = builds[0]
    return service.fetch_recent_commits(latest.repo_url, latest.branch)


# build_id 단건 상태 조회 — 본인 빌드만 (다른 user의 build_id는 404로 마스킹)
@router.get("/{build_id}", response_model=StatusResponse)
def get_status(
    build_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StatusResponse:
    build = service.get_state(db, build_id, user_id=user.id)
    if not build:
        raise HTTPException(status_code=404, detail="build not found")
    return _to_status(build)


# 빌드 목록 — 본인 것만, 최신순
@router.get("", response_model=list[StatusResponse])
def list_builds(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[StatusResponse]:
    return [_to_status(b) for b in service.list_builds(db, user_id=user.id)]
