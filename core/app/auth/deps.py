"""FastAPI 인증 dependency.

get_current_user_optional  — cookie 없거나 만료/revoke면 None
get_current_user           — 위 결과가 None이면 401 raise (mutating endpoint 보호)
"""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as SASession

from app import config
from app.auth import service as auth_service
from app.auth.model import User
from app.shared.db import get_db


def get_current_user_optional(
    request: Request,
    db: SASession = Depends(get_db),
) -> User | None:
    sid = request.cookies.get(config.SESSION_COOKIE_NAME)
    if not sid:
        return None
    sess = auth_service.get_active_session(db, sid)
    if sess is None:
        return None
    return db.query(User).filter_by(id=sess.user_id).first()


def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다",
        )
    return user
