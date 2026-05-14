"""deploy 도메인 DB CRUD."""

from sqlalchemy.orm import Session

from app.deploy.model import Build


# build_id로 단건 조회
def get_build(db: Session, build_id: str) -> Build | None:
    return db.query(Build).filter_by(build_id=build_id).first()


# 전체 빌드 목록 조회 (최신순)
def list_builds(db: Session) -> list[Build]:
    return db.query(Build).order_by(Build.created_at.desc()).all()


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
