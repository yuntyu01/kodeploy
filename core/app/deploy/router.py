from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
    req: DeployRequest, db: Session = Depends(get_db)
) -> DeployResponse:
    try:
        build = await service.start_build(
            db,
            repo_url=str(req.repo_url),
            runtime=req.runtime,
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


# build_id 단건 상태 조회 엔드포인트
@router.get("/{build_id}", response_model=StatusResponse)
def get_status(build_id: str, db: Session = Depends(get_db)) -> StatusResponse:
    build = service.get_state(db, build_id)
    if not build:
        raise HTTPException(status_code=404, detail="build not found")
    return _to_status(build)


# 전체 빌드 목록 조회 엔드포인트 (최신순)
@router.get("", response_model=list[StatusResponse])
def list_builds(db: Session = Depends(get_db)) -> list[StatusResponse]:
    return [_to_status(b) for b in service.list_builds(db)]
