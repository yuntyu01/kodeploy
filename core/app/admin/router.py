"""admin 도메인 엔드포인트 — 관리자 페이지 (role: admin/root 전용).

GET /admin/overview          — 가입/빌드 통계
GET /admin/users             — 가입자 목록 (tenant·빌드 집계 포함)
GET /admin/nodes             — 노드별 CPU/메모리/디스크 사용량
PUT /admin/users/{id}/role   — 등급 변경 (root 전용, user↔admin만)
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.admin import service
from app.auth.deps import get_admin_user, get_root_user
from app.auth.model import User
from app.shared.db import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


class RoleRequest(BaseModel):
    role: str  # "user" | "admin" — service.ASSIGNABLE_ROLES가 검증


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    return service.overview(db)


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> list[dict]:
    return service.list_users(db)


# sync def — K8s proxy 호출(노드당 1회)이 블로킹이라 FastAPI threadpool에서 실행됨.
@router.get("/nodes")
def nodes(_: User = Depends(get_admin_user)) -> list[dict]:
    return service.node_stats()


@router.put("/users/{user_id}/role")
def set_role(
    user_id: uuid.UUID,
    req: RoleRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_root_user),
) -> dict:
    try:
        return service.set_role(db, user_id, req.role, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
