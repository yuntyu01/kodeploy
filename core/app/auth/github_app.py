"""GitHub App installation token — private repo clone 인증.

OAuth 로그인(auth/service.py)이 쓰는 user-to-server 토큰은 로그인 시점에 발급돼 8시간 만에
만료되지만, 빌드는 그 한참 뒤에 돌 수 있다. 그래서 빌드 시점에 **App ID + private key로 App JWT를
직접 서명(RS256)** 하고 installation access token(1h, repo-scoped)으로 교환해 쓴다. 추가 라이브러리
없이 cryptography(이미 의존성)로 서명 — r2.py가 SigV4를 손서명한 것과 같은 스타일.

토큰은 빌드별 Secret에만 담겨(이제 etcd 암호화됨) 빌드 후 삭제된다 — repo_url/Job args/로그/DB
어디에도 남지 않는다. 토큰은 그 유저의 installation에 스코프되므로, 남의 private repo는 clone 불가
(GitHub이 installation 범위 밖 repo 접근을 거부) — 테넌트 간 격리가 GitHub 측에서 강제된다.

흐름: App JWT(iss=App ID) → POST /app/installations/{id}/access_tokens → token(1h).
"""

import base64
import datetime
import json
import threading
import time

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app import config

_API = "https://api.github.com"


# App 자격증명이 갖춰졌는지 (private repo 기능 활성 가능 여부). 비어 있으면 토큰 None → public만.
def is_configured() -> bool:
    return bool(config.GITHUB_APP_ID and config.GITHUB_APP_PRIVATE_KEY)


# base64url (JWT용 — 패딩 '=' 제거)
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


# App JWT — iss=App ID, 10분 만료. RS256(RSA PKCS#1 v1.5 + SHA-256)로 private key 서명.
# iat를 60초 당겨 서버 시계 차이로 인한 'iat in future' 거절 회피(GitHub 권장).
def _app_jwt() -> str:
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {"iat": now - 60, "exp": now + 540, "iss": str(config.GITHUB_APP_ID)}
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    key = serialization.load_pem_private_key(
        config.GITHUB_APP_PRIVATE_KEY.encode("utf-8"), password=None
    )
    signature = key.sign(
        signing_input.encode("ascii"), padding.PKCS1v15(), hashes.SHA256()
    )
    return signing_input + "." + _b64url(signature)


# installation_id → (token, expires_epoch). 토큰 1h 유효 — 빌드마다 새로 발급하지 않게 캐시.
# 백그라운드 빌드 스레드들이 공유하므로 lock으로 보호.
_cache: dict[int, tuple[str, float]] = {}
_lock = threading.Lock()


def _parse_expiry(expires_at: str | None, now: float) -> float:
    # "2026-06-09T06:00:00Z" → epoch. 파싱 실패 시 보수적으로 50분.
    if not expires_at:
        return now + 3000
    try:
        return datetime.datetime.fromisoformat(
            expires_at.replace("Z", "+00:00")
        ).timestamp()
    except ValueError:
        return now + 3000


# 빌드 clone용 installation 토큰. 미설정/없음/실패면 None → 호출부가 토큰 없이 진행(public만).
def get_clone_token(installation_id: int | None) -> str | None:
    if not is_configured() or not installation_id:
        return None

    now = time.time()
    with _lock:
        cached = _cache.get(installation_id)
        if cached and cached[1] - 300 > now:   # 만료 5분 전까지 재사용
            return cached[0]

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{_API}/app/installations/{installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {_app_jwt()}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
    except httpx.HTTPError:
        return None
    if resp.status_code not in (200, 201):
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    token = data.get("token")
    if not token:
        return None

    with _lock:
        _cache[installation_id] = (token, _parse_expiry(data.get("expires_at"), now))
    return token
