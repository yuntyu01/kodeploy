from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.model import User
from app.deploy import service
from app.deploy.model import Build
from app.deploy.schemas import DeployRequest, DeployResponse, StatusResponse
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
    try:
        build = await service.start_build(
            db,
            repo_url=str(req.repo_url),
            runtime=req.runtime,
            user=user,
            name=req.name,
            branch=req.branch,
            port=req.port,
            use_db=req.use_db,
            build_mode=req.build_mode,
            dockerfile_path=req.dockerfile_path,
            project_path=req.project_path,
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


# 사용자의 최신 build의 repo+branch에서 GitHub 최근 커밋 N개 조회.
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
