"""deploy 도메인 DB CRUD."""

import uuid

from sqlalchemy.orm import Session

from app.deploy.model import Build


# build_id로 단건 조회
def get_build(db: Session, build_id: str) -> Build | None:
    return db.query(Build).filter_by(build_id=build_id).first()


# 전체 빌드 목록 조회 (최신순)
def list_builds(db: Session) -> list[Build]:
    return db.query(Build).order_by(Build.created_at.desc()).all()


def get_build_by_app_name(
    db: Session, app_name: str, user_id: "uuid.UUID | None" = None,
) -> Build | None:
    q = db.query(Build).filter_by(app_name=app_name)
    if user_id is not None:
        q = q.filter_by(user_id=user_id)
    return q.order_by(Build.created_at.desc()).first()


# 새 빌드 row 생성/저장
def create_build(db: Session, build: Build) -> Build:
    db.add(build)
    db.commit()
    db.refresh(build)
    return build


# status/error/logs 등 부분 필드 갱신
def update_build(db: Session, build_id: str, **fields) -> None:
    db.query(Build).filter_by(build_id=build_id).update(fields)
    db.commit()
