"""auth 도메인 엔드포인트 (GitHub App user-to-server OAuth).

GET  /auth/github/login    — state cookie 발급 + GitHub authorize로 302
GET  /auth/github/callback — code/state 검증 → 세션 발급 + WEB_BASE_URL로 302
GET  /auth/me              — 현재 user (401 if 미로그인)
POST /auth/logout          — 세션 revoke + cookie 삭제
"""

import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session as SASession

from app import config
from app.auth import service as auth_service
from app.auth.deps import get_current_user
from app.auth.model import User
from app.auth.schemas import UserOut
from app.shared.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


# 세션 cookie 설정 — 정책(secure/samesite/domain)은 config에서.
# httponly=True 고정 — JS에서 cookie 읽지 못하게(XSS 시 탈취 방지).
def _set_session_cookie(response: Response, sid: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=sid,
        max_age=config.SESSION_LIFETIME_DAYS * 86400,
        httponly=True,
        secure=config.SESSION_COOKIE_SECURE,
        samesite=config.SESSION_COOKIE_SAMESITE,
        domain=config.SESSION_COOKIE_DOMAIN,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=config.SESSION_COOKIE_NAME,
        domain=config.SESSION_COOKIE_DOMAIN,
        path="/",
    )


@router.get("/github/login")
def github_login():
    if not config.GITHUB_CLIENT_ID or not config.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub App 미구성 (GITHUB_CLIENT_ID/SECRET)",
        )
    state = secrets.token_urlsafe(32)
    response = RedirectResponse(
        url=auth_service.build_authorize_url(state), status_code=302
    )
    # OAuth state cookie — callback에서 query state와 일치 확인. SameSite=Lax 고정:
    # top-level GET navigation은 Lax에서도 cookie 첨부됨. 짧은 만료(10분).
    response.set_cookie(
        key=config.OAUTH_STATE_COOKIE_NAME,
        value=state,
        max_age=config.OAUTH_STATE_TTL_SECONDS,
        httponly=True,
        secure=config.SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: SASession = Depends(get_db),
):
    # 사용자가 GitHub 동의 거부 시 — 그냥 web으로 돌려보냄 (UI에서 알림)
    if error:
        return RedirectResponse(
            url=f"{config.WEB_BASE_URL}/?login=denied", status_code=302
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="code/state 누락")

    cookie_state = request.cookies.get(config.OAUTH_STATE_COOKIE_NAME)
    if not cookie_state or not secrets.compare_digest(cookie_state, state):
        raise HTTPException(status_code=400, detail="state 검증 실패 (CSRF 방지)")

    try:
        access_token = await auth_service.exchange_code_for_token(code)
        gh_user = await auth_service.fetch_github_user(access_token)
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(status_code=502, detail=f"GitHub 인증 실패: {e}")

    user = auth_service.upsert_user(db, gh_user)
    sess = auth_service.create_session(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )

    response = RedirectResponse(
        url=f"{config.WEB_BASE_URL}/?login=ok", status_code=302
    )
    _set_session_cookie(response, sess.id)
    response.delete_cookie(config.OAUTH_STATE_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: SASession = Depends(get_db),
):
    sid = request.cookies.get(config.SESSION_COOKIE_NAME)
    if sid:
        auth_service.revoke_session(db, sid)
    _clear_session_cookie(response)
    return {"status": "ok"}
