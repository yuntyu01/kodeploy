"""배포 오케스트레이션."""

import asyncio
import base64
import json
import os.path
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

from kubernetes.client.exceptions import ApiException
from publicsuffixlist import PublicSuffixList
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import config
from app.auth import github_app
from app.auth.model import User
from app.deploy import crud, domains, env as env_module, manifests, r2, snapshots
from app.deploy.model import Build, BuildRecord
from app.shared import k8s
from app.shared.db import SessionLocal


# 백그라운드 오케스트레이션을 전용 daemon 스레드의 자체 이벤트 루프에서 실행.
# _run_build 등은 async지만 내부에서 동기 K8s/DB 클라이언트 + _ensure_tenant_ns의
# time.sleep(최대 60초)을 쓴다. uvicorn 워커 1개 = 메인 루프 1개라, 메인 루프에 올리면
# 빌드 도는 동안 /healthz 포함 전 유저 요청이 멈춘다. 스레드마다 asyncio.run으로 독립
# 루프를 띄워 블로킹을 그 스레드에 격리 — 코루틴 로직(빌드→배포→대기)은 그대로 보존.
# 빌드는 I/O 바운드라 빌드당 스레드 1개로 충분. create_task와 달리 GC로 사라질 위험도 없음.
def spawn_background(coro_func, *args) -> None:
    threading.Thread(
        target=lambda: asyncio.run(coro_func(*args)),
        daemon=True,
    ).start()


# repo URL 정규화 (BuildKit이 요구하는 .git 접미사 보장)
def _normalize_repo_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url.endswith(".git"):
        url = url + ".git"
    return url


_GITHUB_REPO_PATTERN = re.compile(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$")


# Public GitHub repo에서 파일 텍스트를 raw URL로 fetch. 실패하면 None (빌드는 계속).
# Private repo · GitHub 외 SCM은 미지원 — 그 경우엔 dockerfile_content NULL로 두고
# UI에서 "표시 불가"로 처리.
def _fetch_github_raw(repo_url: str, branch: str, path: str) -> str | None:
    m = _GITHUB_REPO_PATTERN.match(repo_url)
    if not m:
        return None
    user, repo = m.group(1), m.group(2)
    raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}"
    try:
        with urllib.request.urlopen(raw_url, timeout=10) as resp:
            if resp.status == 200:
                return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError):
        pass
    return None


# 빌드 user의 installation id 조회 (private repo tree/clone 토큰 발급용). 없으면 None.
def _installation_id_for(build: Build) -> "int | None":
    if build.user_id is None:
        return None
    db = SessionLocal()
    try:
        owner = db.query(User).filter_by(id=build.user_id).first()
        return owner.github_installation_id if owner else None
    finally:
        db.close()


# nixpacks가 프로젝트 루트로 인식하는 마커 파일 — auto 모드의 앱 디렉토리 자동 탐색용.
# 현재 KoDeploy 지원 런타임(Python·Java·PHP)의 마커만 활성. 다른 언어는 그 런타임 추가 시 주석 해제.
_NIXPACKS_MARKERS = frozenset({
    # Python
    "requirements.txt", "pyproject.toml", "Pipfile", "setup.py",
    # Java
    "pom.xml", "build.gradle", "build.gradle.kts",
    # PHP
    "composer.json",
    # --- 미지원 런타임 (지원 추가 시 주석 해제) ---
    # "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",  # JavaScript / Node
    # "go.mod",      # Go
    # "Gemfile",     # Ruby
    # "Cargo.toml",  # Rust
    # "mix.exs",     # Elixir
})


# build_mode="detect" 해소 — GitHub tree API로 빌드 방식 + 경로를 한 번에 감지 (깊이 3까지).
#   1) Dockerfile 있으면        → ("dockerfile", 그 경로)
#   2) 없고 nixpacks 마커 있으면 → ("auto", 그 디렉토리)  ← 모노레포 서브디렉토리 자동
#   3) 둘 다 없으면             → ("auto", project_path 그대로) — nixpacks가 root에서 시도
# project_path 하위 우선, root에 가까운 것 우선. private은 installation 토큰. fallback 아님(존재 기반).
def _detect_build(build: Build) -> "tuple[str, str]":
    fallback = ("auto", build.project_path or "")
    m = _GITHUB_REPO_PATTERN.match(build.repo_url.rstrip("/"))
    if not m:
        return fallback
    owner, repo = m.group(1), m.group(2)
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "kodeploy"}
    token = github_app.get_clone_token(_installation_id_for(build))
    if token:
        headers["Authorization"] = f"Bearer {token}"
    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/"
        f"{urllib.parse.quote(build.branch)}?recursive=1"
    )
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return fallback

    prefix = (build.project_path or "").strip("/")

    def in_scope(p: str) -> bool:
        return not prefix or p == prefix or p.startswith(f"{prefix}/")

    dockerfiles, markers = [], []
    for item in data.get("tree", []):
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        if path.count("/") > 3:                        # 깊이 3 초과 제외
            continue
        name = path.rsplit("/", 1)[-1]
        if name == "Dockerfile" and in_scope(path):
            dockerfiles.append(path)
        elif name in _NIXPACKS_MARKERS and in_scope(path):
            markers.append(path)

    if dockerfiles:                                    # Dockerfile 우선 (root 가까운 것)
        dockerfiles.sort(key=lambda p: p.count("/"))
        return ("dockerfile", dockerfiles[0])
    if markers:                                        # nixpacks 마커 디렉토리
        markers.sort(key=lambda p: p.count("/"))
        best = markers[0]
        return ("auto", best.rsplit("/", 1)[0] if "/" in best else "")
    return fallback


# 예약 서브도메인 (시스템 인프라용) — 유저 입력 거절
RESERVED_NAMES = {
    "api",       # kodeploy-core
    "ssh",       # cloudflared 터널
    "www",       # 미래 KoDeploy 랜딩
    "admin",     # 미래 관리 페이지
    "auth",      # 미래 인증
    "dashboard", # 미래 유저 대시보드
    "docs",      # 미래 문서 사이트
    "app",       # 자동 생성 prefix 충돌 회피
    "apps",
    "kodeploy",  # 브랜드명
    "origin",    # CF for SaaS fallback origin (origin.kodeploy.com) — 유저가 잡으면 커스텀 도메인 전부 깨짐
}

# DNS-1123 label rule (K8s metadata.name + 서브도메인 둘 다 만족)
_NAME_PATTERN = re.compile(r"^[a-z]([-a-z0-9]*[a-z0-9])?$")
_NAME_MAX_LENGTH = 40


def _validate_name_format(name: str) -> None:
    if name.startswith("app-"):
        raise ValueError("'app-' prefix는 자동 생성용으로 예약돼 있음")
    if name.endswith("-api"):
        # {app}-api.kodeploy.com이 서버 슬롯 파생 호스트라 — 남의 "foo" 앱의 서버 주소와
        # "foo-api"라는 새 앱 이름이 충돌하지 않게 suffix 자체를 금지.
        raise ValueError("'-api'로 끝나는 이름은 서버 주소용으로 예약돼 있음")
    if name in RESERVED_NAMES:
        raise ValueError(f"예약 이름: {name}")
    if len(name) > _NAME_MAX_LENGTH:
        raise ValueError(f"이름 너무 김 (최대 {_NAME_MAX_LENGTH}자)")
    if not _NAME_PATTERN.match(name):
        raise ValueError("DNS-1123 label 규칙 위배 (소문자 시작 + 영숫자/하이픈만)")


# repo URL 마지막 segment → 이름 후보. 형식 검증 통과 못하면 None.
def _extract_from_repo(repo_url: str) -> str | None:
    m = re.search(r"/([^/]+?)(?:\.git)?$", repo_url)
    if not m:
        return None
    candidate = re.sub(r"[^a-z0-9-]", "-", m.group(1).lower()).strip("-")
    candidate = candidate[:_NAME_MAX_LENGTH]
    if not candidate:
        return None
    try:
        _validate_name_format(candidate)
    except ValueError:
        return None
    return candidate


# 1유저=1앱: user.app_name이 있으면 그대로 재사용 (변경 불가). 없으면 첫 배포로 보고
# 입력값 검증 + 다른 유저와 중복 검사 후 user.app_name에 저장.
def _resolve_app_name(
    name: str | None,
    repo_url: str,
    user: User,
    db: Session,
) -> str:
    # 두 번째 배포 이후 — 이미 고정된 이름 그대로
    if user.app_name:
        return user.app_name

    # 첫 배포 — 입력값 검증 또는 자동 생성
    if name:
        _validate_name_format(name)
        candidate = name
    else:
        candidate = _extract_from_repo(repo_url) or f"app-{uuid.uuid4().hex[:8]}"

    # 다른 유저가 이미 쓰고 있는지 확인 (DB unique 제약이 막아주지만 친절한 에러용)
    existing = db.query(User).filter(User.app_name == candidate).first()
    if existing:
        raise ValueError(f"이미 사용 중인 이름: {candidate}")

    # user에 fix (이후 배포는 자동으로 이 이름 재사용)
    user.app_name = candidate
    db.commit()
    return candidate


# build_id로 단건 빌드 상태 조회 — user_id 주면 본인 빌드만
def get_state(
    db: Session, build_id: str, user_id: uuid.UUID | None = None,
) -> Build | None:
    return crud.get_build(db, build_id, user_id=user_id)


# 빌드 목록 (user_id 주면 본인 것만)
def list_builds(db: Session, user_id: uuid.UUID | None = None) -> list[Build]:
    return crud.list_builds(db, user_id=user_id)


# env_change row의 status를 Pod 결과에 따라 갱신.
# - 빌드 row는 영구 기록(안 건드림). 이 함수는 특정 env_change row(build_id로 식별)에만 적용.
# - ready 되면 "running", 5분 타임아웃이면 "failed"로.
async def watch_env_change_rollout(
    user_id: uuid.UUID, app_name: str, tenant_id: str, event_build_id: str,
) -> None:
    deadline = time.time() + ROLLOUT_TIMEOUT_SECONDS
    apps = k8s.apps_v1()
    while time.time() < deadline:
        try:
            dep = apps.read_namespaced_deployment_status(
                name=app_name, namespace=tenant_id,
            )
        except ApiException:
            await asyncio.sleep(5)
            continue
        ready = dep.status.ready_replicas or 0
        desired = dep.spec.replicas or 1
        observed = dep.status.observed_generation or 0
        current = dep.metadata.generation or 0
        if ready >= desired and observed >= current:
            _update_event_status(user_id, event_build_id, "running")
            return
        await asyncio.sleep(5)
    _update_event_status(
        user_id, event_build_id, "failed", error="Pod 시작 실패 (타임아웃)",
    )


def _update_event_status(
    user_id: uuid.UUID, build_id: str, status: str, error: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        row = (
            db.query(Build)
            .filter_by(build_id=build_id, user_id=user_id)
            .first()
        )
        if row:
            row.status = status
            if error is not None:
                row.error = error
            db.commit()
    finally:
        db.close()


# 현재 user 앱의 Pod 상태 — 빌드와 무관한 실시간 표시용.
# build.status는 그 빌드 시점의 영구 기록이고, 이 함수는 "지금 살아있나"만 본다.
#
# 분류:
#   "running"  — Pod Running + Ready 조건 True
#   "pending"  — 스케줄링/이미지 pull/부팅 중 또는 Running but not ready
#   "crashing" — CrashLoopBackOff / ImagePullBackOff / Failed phase / restart 폭주
#   "missing"  — Deployment 없음 또는 Pod 0 (첫 배포 전 또는 삭제 후)
_CRASH_REASONS = (
    "CrashLoopBackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerError",
    "CreateContainerConfigError",
)


# 한 슬롯(라벨 셀렉터)의 Pod 상태 분류 — {"status", "started_at"}.
def _slot_pod_status(core, tenant_id: str, app_label: str) -> dict:
    try:
        pods = core.list_namespaced_pod(
            namespace=tenant_id, label_selector=f"app={app_label}",
        )
    except ApiException as e:
        if e.status == 404:
            return {"status": "missing", "started_at": None}
        raise
    if not pods.items:
        return {"status": "missing", "started_at": None}

    pod = max(
        pods.items,
        key=lambda p: p.status.start_time.timestamp() if p.status.start_time else 0,
    )
    started_at = (
        pod.status.start_time.isoformat() if pod.status.start_time else None
    )

    phase = pod.status.phase
    if phase == "Running":
        conditions = pod.status.conditions or []
        ready = any(c.type == "Ready" and c.status == "True" for c in conditions)
        if ready:
            return {"status": "running", "started_at": started_at}
        for cs in pod.status.container_statuses or []:
            if cs.state and cs.state.waiting:
                if (cs.state.waiting.reason or "") in _CRASH_REASONS:
                    return {"status": "crashing", "started_at": started_at}
        return {"status": "pending", "started_at": started_at}

    if phase == "Failed":
        return {"status": "crashing", "started_at": started_at}

    for cs in pod.status.container_statuses or []:
        if cs.state and cs.state.waiting:
            if (cs.state.waiting.reason or "") in _CRASH_REASONS:
                return {"status": "crashing", "started_at": started_at}
    return {"status": "pending", "started_at": started_at}


# 슬롯별 상태 + 대표 상태. 응답:
#   {status, started_at,            ← 대표 (서버 우선, 없으면 정적 — 위젯 최소화 라벨 등)
#    server: {status, started_at},  ← 서버 슬롯 (정적 단독이면 "missing")
#    site:   {status, started_at} | null}  ← site_enabled 아닐 땐 null
def get_app_status(user: User) -> dict:
    if not user.app_name:
        return {"status": "missing", "started_at": None, "server": None, "site": None}
    tenant_id = f"tenant-{user.id.hex[:8]}"
    core = k8s.core_v1()

    server = _slot_pod_status(core, tenant_id, user.app_name)
    site = (
        _slot_pod_status(core, tenant_id, f"{user.app_name}-static")
        if user.site_enabled
        else None
    )
    rep = server if server["status"] != "missing" else (site or server)
    return {**rep, "server": server, "site": site}


# 앱 완전 삭제 — tenant namespace 통째로 삭제하면 K8s가 cascade로
# 안의 모든 자원(Deployment/Service/HTTPRoute/STS/PVC/Secret/ResourceQuota) 자동 정리.
# 같은 user_id로 재배포하면 같은 tenant_id 쓰는데, ns가 terminating이면 _ensure_tenant_ns가
# 사라질 때까지 잠시 대기 후 새 create. GHCR 이미지는 보존 (별도 정리).
def delete_app(db: Session, user: User) -> None:
    if not user.app_name:
        raise ValueError("삭제할 앱이 없습니다")

    tenant_id = f"tenant-{user.id.hex[:8]}"

    # R2는 외부(CF) 리소스라 ns 삭제로 정리 안 됨 — ns 지우기 전에 토큰 id를 읽어둔다.
    app_name = user.app_name
    r2_token_id = None
    try:
        r2_token_id = _read_r2_token_id(tenant_id)
    except ApiException:
        pass  # 정리 정보 조회 실패가 앱 삭제를 막지 않게

    # ns 삭제는 비동기 — terminating 상태로 들어가고 finalizer 정리 끝나면 사라짐.
    # 사용자에겐 즉시 응답하고 다음 배포 시점에 대기.
    try:
        k8s.core_v1().delete_namespace(name=tenant_id)
    except ApiException as e:
        if e.status != 404:
            raise

    # R2 토큰 revoke + 버킷 삭제 (앱 완전 삭제이므로 데이터도 정리). best-effort.
    if r2_token_id or app_name:
        try:
            r2.deprovision(
                r2_token_id,
                bucket=r2.bucket_name(app_name) if app_name else None,
            )
        except r2.R2Error:
            pass  # 외부 정리 실패가 DB/응답을 막지 않게 — orphan은 sweeper(백로그)

    # 커스텀 도메인 CF custom hostname 정리 (외부 리소스라 ns 삭제로 안 사라짐). best-effort.
    if user.custom_domain:
        try:
            domains.delete(user.custom_domain)
        except domains.DomainError:
            pass

    # DB: builds 히스토리 + user.app_name/custom_domain/슬롯 선언 리셋. 다음 배포는 첫 배포 흐름.
    # build_records(빌드 행위 영구 기록)는 운영 분석용 append-only라 의도적으로 보존.
    # extra_hostnames도 클리어 — 옛 앱용 hostname이 다음(다른) 앱 route에 자동 주입되면 안 됨.
    db.query(Build).filter(Build.user_id == user.id).delete()
    user.app_name = None
    user.custom_domain = None
    user.custom_domain_status = None
    user.extra_hostnames = None
    user.site_enabled = False
    db.commit()


# GitHub 커밋 캐시 — unauthenticated 한도(IP당 60req/h, core egress IP 공유) 보호.
# (owner, repo, branch) → {"etag", "data", "at"}.
# - TTL 안: 네트워크 생략 (탭/유저 수와 무관하게 repo당 분당 최대 1회)
# - TTL 후: If-None-Match 조건부 요청 — 304는 GitHub이 rate limit에서 차감 안 함
# - 403(한도 초과) 등 실패: stale 캐시라도 반환 — UI가 갑자기 비지 않게
_COMMITS_CACHE: dict[tuple, dict] = {}
_COMMITS_TTL_SECONDS = 60


# 최근 커밋 조회 — public repo 한정 (unauthenticated GitHub API).
# private repo 지원은 App installation token 도입 시 분기 추가.
# 실패는 캐시 fallback → 빈 리스트로 swallow — UI에서 "없음" 표시되면 충분.
def fetch_recent_commits(
    repo_url: str, branch: str, per_page: int = 10,
) -> list[dict]:
    m = _GITHUB_REPO_PATTERN.match(repo_url.rstrip("/"))
    if not m:
        return []
    owner, repo = m.group(1), m.group(2)

    key = (owner, repo, branch)
    now = time.time()
    cached = _COMMITS_CACHE.get(key)
    if cached and now - cached["at"] < _COMMITS_TTL_SECONDS:
        return cached["data"]

    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?sha={branch}&per_page={per_page}"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "kodeploy",
    }
    if cached and cached.get("etag"):
        headers["If-None-Match"] = cached["etag"]
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
            etag = resp.headers.get("ETag")
    except urllib.error.HTTPError as e:
        if e.code == 304 and cached:          # 변경 없음 — 한도 미차감, 캐시 연장
            cached["at"] = now
            return cached["data"]
        return cached["data"] if cached else []  # 403(한도) 등 — stale 캐시 fallback
    except (urllib.error.URLError, TimeoutError, ValueError):
        return cached["data"] if cached else []
    out = []
    for c in data:
        try:
            full_msg = c["commit"]["message"]
            title, _, body = full_msg.partition("\n")
            out.append({
                "sha": c["sha"][:7],
                "message": title.strip(),
                "body": body.strip(),  # 빈 문자열 가능 — UI에서 "(본문 없음)" 처리
                "author": c["commit"]["author"].get("name", "unknown"),
                "date": c["commit"]["author"].get("date"),
                "url": c["html_url"],
            })
        except (KeyError, TypeError):
            continue
    _COMMITS_CACHE[key] = {"etag": etag, "data": out, "at": now}
    return out


_ACTIVE_STATUSES = {"queued", "building", "built", "deploying"}


# slot="server"|"static" — 그 슬롯의 활성 빌드만 취소.
# 두 슬롯이 한 제출에서 동시에 빌드되므로 유저 전체 취소면 서로 죽인다.
def _cancel_stale_builds(db: Session, user_id: uuid.UUID, slot: str) -> None:
    q = db.query(Build).filter(
        Build.user_id == user_id,
        Build.status.in_(_ACTIVE_STATUSES),
    )
    if slot == "static":
        q = q.filter(Build.runtime == "static")
    else:
        q = q.filter(Build.runtime != "static")
    stale = q.all()
    if not stale:
        return
    for build in stale:
        build.status = "cancelled"
        _cleanup_build_job(build.build_id, build.user_id_str)
    db.commit()


def _cleanup_build_job(build_id: str, user_id_str: str) -> None:
    job_name = _build_job_name(build_id, user_id_str)
    try:
        k8s.batch_v1().delete_namespaced_job(
            name=job_name,
            namespace=config.BUILD_NAMESPACE,
            propagation_policy="Background",
        )
    except ApiException as e:
        if e.status != 404:
            raise
    _cleanup_git_auth(build_id)


# --- private repo clone 인증 (GitHub App installation token) -------------------
# 빌드별 Secret에 토큰을 담아 잡이 마운트, 빌드 후 삭제. 토큰은 그 유저 installation에 스코프돼
# 남의 private repo는 GitHub이 거부 — 격리 자동. See app/auth/github_app.py.

def _git_auth_secret_name(build_id: str) -> str:
    return f"git-auth-{build_id}"


# build의 user가 App 설치(installation_id)했고 App이 설정돼 있으면 installation token을 발급해
# kodeploy-build ns의 Secret에 담고 그 이름을 반환. 토큰 없으면(미설치/미설정/실패) "" → public clone.
def _provision_git_auth(build: Build) -> str:
    if build.user_id is None or not github_app.is_configured():
        return ""
    db = SessionLocal()
    try:
        owner = db.query(User).filter_by(id=build.user_id).first()
        installation_id = owner.github_installation_id if owner else None
    finally:
        db.close()
    token = github_app.get_clone_token(installation_id)
    if not token:
        return ""
    name = _git_auth_secret_name(build.build_id)
    body = {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {
            "name": name,
            "namespace": config.BUILD_NAMESPACE,
            "labels": {"app": "kodeploy-build", "build-id": build.build_id},
        },
        "type": "Opaque",
        "stringData": {"GIT_AUTH_TOKEN": token},
    }
    core = k8s.core_v1()
    try:
        core.create_namespaced_secret(namespace=config.BUILD_NAMESPACE, body=body)
    except ApiException as e:
        if e.status != 409:  # 재시도 등으로 이미 있으면 최신 토큰으로 교체
            raise
        core.replace_namespaced_secret(
            name=name, namespace=config.BUILD_NAMESPACE, body=body
        )
    return name


def _cleanup_git_auth(build_id: str) -> None:
    try:
        k8s.core_v1().delete_namespaced_secret(
            name=_git_auth_secret_name(build_id), namespace=config.BUILD_NAMESPACE
        )
    except ApiException as e:
        if e.status != 404:
            raise


# static 빌드 입력 검증/정규화. 보안 경계 아님(유저는 어차피 자기 이미지 빌드 내용을 전부
# 통제) — 개행 등으로 생성 Dockerfile이 조용히 깨져 정체불명 빌드 에러가 되는 걸 막는 친절벨트.
_OUTPUT_DIR_PATTERN = re.compile(r"^[A-Za-z0-9._/-]+$")


# 빌드 타임 변수 검증 — 키는 셸/Dockerfile 호환 형식(env.py와 동일 규칙), 값은 한 줄 텍스트.
# 값이 번들에 박혀 공개되는 입력이라 보안 경계는 아니고, ENV 줄이 조용히 깨지는 것만 방지.
_ENV_KEY_PATTERN = re.compile(r"^[A-Z_][A-Z0-9_]*$")
_BUILD_ENV_MAX_KEYS = 20
_BUILD_ENV_MAX_VALUE = 1000


def _validate_static_env(env: dict[str, str]) -> dict[str, str]:
    if len(env) > _BUILD_ENV_MAX_KEYS:
        raise ValueError(f"빌드 타임 변수는 최대 {_BUILD_ENV_MAX_KEYS}개까지입니다")
    out: dict[str, str] = {}
    for k, v in env.items():
        k = k.strip()
        if not _ENV_KEY_PATTERN.match(k):
            raise ValueError(f"변수 이름 형식 위배: {k} (대문자/숫자/_ 만, 영문 대문자나 _로 시작)")
        if len(v) > _BUILD_ENV_MAX_VALUE:
            raise ValueError(f"{k} 값이 너무 깁니다 (최대 {_BUILD_ENV_MAX_VALUE}자)")
        if any(ch in v for ch in "\n\r"):
            raise ValueError(f"{k} 값에 줄바꿈은 쓸 수 없습니다")
        out[k] = v
    return out


def _validate_static_fields(build_cmd: str, output_dir: str) -> tuple[str, str]:
    build_cmd = (build_cmd or "").strip()
    if "\n" in build_cmd or "\r" in build_cmd:
        raise ValueError("빌드 커맨드에 줄바꿈은 쓸 수 없습니다 (&&로 이어주세요)")
    if len(build_cmd) > 300:
        raise ValueError("빌드 커맨드가 너무 깁니다 (최대 300자)")
    output_dir = (output_dir or "").strip().strip("/")
    if output_dir and (not _OUTPUT_DIR_PATTERN.match(output_dir) or ".." in output_dir):
        raise ValueError("출력 디렉토리 경로가 올바르지 않습니다 (예: dist, build)")
    if build_cmd and not output_dir:
        output_dir = "dist"
    return build_cmd, output_dir


# 로컬 볼륨 입력 검증/정규화 — 영속저장소 "local" 모드.
# mount_path는 절대경로 belt(보안 경계 아님 — 유저가 자기 이미지를 통제), storage_class는 DNS 라벨,
# size는 K8s quantity 형식. 형식이 깨져 PVC가 admission 거부되는 정체불명 실패를 사전 차단.
_VOLUME_MOUNT_PATTERN = re.compile(r"^/[A-Za-z0-9._/-]+$")
_STORAGE_CLASS_PATTERN = re.compile(r"^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")
_VOLUME_SIZE_PATTERN = re.compile(r"^[1-9][0-9]*(Mi|Gi|Ti)$")


def _validate_volume_fields(
    mount_path: str, storage_class: str, size: str,
) -> tuple[str, str, str]:
    mp = (mount_path or "").strip().rstrip("/")  # 뒤 슬래시 정리 (앞 슬래시는 절대경로라 보존)
    if not mp or ".." in mp or not _VOLUME_MOUNT_PATTERN.match(mp):
        raise ValueError("마운트 경로는 절대경로여야 합니다 (예: /var/www/html/data)")
    sc = (storage_class or "local-path").strip()
    if not _STORAGE_CLASS_PATTERN.match(sc):
        raise ValueError("storage class 이름 형식이 올바르지 않습니다 (예: local-path)")
    sz = (size or "5Gi").strip()
    if not _VOLUME_SIZE_PATTERN.match(sz):
        raise ValueError("볼륨 크기 형식이 올바르지 않습니다 (예: 5Gi, 512Mi)")
    return mp, sc, sz


# 배포 제출 — 원하는 스택(서버 슬롯 + 정적 슬롯)을 선언받아 슬롯별 빌드/teardown을 spawn.
# user 객체로 받음 — _resolve_app_name이 user.app_name을 읽고/쓰기 위해.
# 반환: 이 제출이 만든 Build row들 (슬롯당 최대 1개).
async def start_deploy(
    db: Session,
    user: User,
    repo_url: str,
    runtime: str,                          # "python" | "java" | "none"(서버 없음)
    name: str | None = None,
    branch: str = "main",
    port: int = 80,
    db_type: str = "none",
    use_redis: bool = False,
    storage: str = "none",                 # 영속저장소 — "none" | "local" | "object"
    volume_mount_path: str = "",           # local 전용 — PVC 마운트 경로
    volume_storage_class: str = "local-path",
    volume_size: str = "5Gi",
    build_mode: str = "dockerfile",
    dockerfile_path: str = "Dockerfile",
    project_path: str = "",
    env_vars: dict[str, str] | None = None,
    init_dump_token: str | None = None,
    use_static: bool = False,
    static_repo_url: str = "",
    static_branch: str = "",
    static_project_path: str = "",
    build_cmd: str = "",
    output_dir: str = "",
    static_env: dict[str, str] | None = None,
) -> list[Build]:
    has_server = runtime != "none"
    if not has_server and not use_static:
        raise ValueError("서버 런타임이나 정적 사이트 중 하나는 선택해야 합니다")
    # 영속저장소 셀렉터 → 내부 표현. object=R2(use_storage) / local=PVC(volume_mount_path 비어있지 않음).
    # 한 앱에 둘 다는 없음 — 단일 셀렉터라 상호배타 (DB 한 개 정책과 동일 철학).
    use_storage = storage == "object"
    use_volume = storage == "local"
    if not has_server and (db_type != "none" or use_redis or storage != "none"):
        raise ValueError("DB · Redis · 저장소는 서버 런타임과 함께만 쓸 수 있습니다")
    # object(R2)는 CF 설정이 갖춰졌을 때만 — 빌드 시작 전에 친절히 거절.
    if use_storage and not r2.is_configured():
        raise ValueError("오브젝트 스토리지(R2)가 서버에 설정되지 않았습니다")
    # local(PVC) 입력 검증 — 정규화한 값으로 교체 (mount_path 절대경로 / class·size 형식).
    if use_volume:
        volume_mount_path, volume_storage_class, volume_size = _validate_volume_fields(
            volume_mount_path, volume_storage_class, volume_size
        )
    if use_static:
        build_cmd, output_dir = _validate_static_fields(build_cmd, output_dir)
        static_env = _validate_static_env(static_env or {})

    repo_url = _normalize_repo_url(repo_url)
    app_name = _resolve_app_name(name, repo_url, user, db)

    # 슬롯 선언 저장 — 라우팅 규칙(_slot_hostnames)의 진실원.
    # 빌드 spawn 전에 확정해서 동시 빌드 둘 다 같은 desired state를 보게 한다.
    user.site_enabled = use_static
    db.commit()

    builds: list[Build] = []

    # --- 서버 슬롯 ---
    _cancel_stale_builds(db, user.id, slot="server")
    if has_server:
        build_id = uuid.uuid4().hex[:8]
        image = f"ghcr.io/{config.GHCR_USER}/{user.id.hex[:8]}/{app_name}:{build_id}"
        server_build = Build(
            build_id=build_id,
            repo_url=repo_url,
            branch=branch,
            image=image,
            app_name=app_name,
            port=port,
            runtime=runtime,
            user_id=user.id,
            db_type=db_type,
            use_redis=use_redis,
            use_storage=use_storage,
            volume_mount_path=volume_mount_path if use_volume else "",  # local 아니면 "" = 볼륨 비활성
            volume_storage_class=volume_storage_class,
            volume_size=volume_size,
            build_mode=build_mode,
            dockerfile_path=dockerfile_path,
            project_path=project_path.strip("/"),  # 앞뒤 슬래시 정리 — manifest에서 ${PROJECT_PATH:+/$PROJECT_PATH}로 결합
        )
        builds.append(crud.create_build(db, server_build))
        spawn_background(_run_build, build_id, env_vars or {}, init_dump_token)
    else:
        # 서버 사용 안 함 — 기존 서버 리소스 + deps 정리 (PVC·버킷 보존). 매 제출마다
        # spawn이라 직전 실패도 다음 제출에서 재시도되는 self-healing.
        spawn_background(_teardown_server, user.id)

    # --- 정적 슬롯 ---
    _cancel_stale_builds(db, user.id, slot="static")
    if use_static:
        site_name = f"{app_name}-static"               # K8s 리소스 이름 (호스트는 {app} — 슬롯 규칙)
        s_repo = _normalize_repo_url(static_repo_url) if static_repo_url.strip() else repo_url
        build_id = uuid.uuid4().hex[:8]
        image = f"ghcr.io/{config.GHCR_USER}/{user.id.hex[:8]}/{site_name}:{build_id}"
        static_build = Build(
            build_id=build_id,
            repo_url=s_repo,
            branch=static_branch.strip() or branch,
            image=image,
            app_name=site_name,
            port=8080,                                 # nginx-unprivileged 고정
            runtime="static",
            user_id=user.id,
            db_type="none",
            use_redis=False,
            use_storage=False,
            build_mode="static",
            project_path=static_project_path.strip("/"),
            build_cmd=build_cmd,
            output_dir=output_dir,
            build_env=json.dumps(static_env) if static_env else None,
        )
        builds.append(crud.create_build(db, static_build))
        spawn_background(_run_build, build_id)
    else:
        spawn_background(_teardown_static, user.id)

    return builds


# 서버 슬롯 teardown — Deployment/Service/Route 쌍 + deps(mysql/postgres/redis/r2) 정리.
# PVC·버킷·Secret은 보존 (DB 토글 off와 동일 철학 — 다시 켜면 데이터 복원).
# best-effort: 실패는 삼킴 — 슬롯 off인 제출마다 다시 spawn되므로 다음 기회에 재시도.
async def _teardown_server(user_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user or not user.app_name:
            return
        app_name = user.app_name
        ns = f"tenant-{user_id.hex[:8]}"
        apps = k8s.apps_v1()
        core = k8s.core_v1()
        custom = k8s.custom()
        for call in (
            lambda: apps.delete_namespaced_deployment(name=app_name, namespace=ns),
            lambda: core.delete_namespaced_service(name=app_name, namespace=ns),
            lambda: custom.delete_namespaced_custom_object(
                group="gateway.networking.k8s.io", version="v1", namespace=ns,
                plural="httproutes", name=app_name),
            lambda: custom.delete_namespaced_custom_object(
                group="gateway.networking.k8s.io", version="v1", namespace=ns,
                plural="httproutes", name=f"{app_name}-redirect"),
        ):
            try:
                call()
            except ApiException as e:
                if e.status != 404:
                    raise
        _teardown_one_db(ns, "mysql")
        _teardown_one_db(ns, "postgres")
        _teardown_redis(ns)
        _teardown_storage(ns)
    except ApiException:
        pass
    finally:
        db.close()


# 정적 슬롯 teardown — 사이트 Deployment/Service/Route 쌍 삭제 + 서버 hostnames 원복.
async def _teardown_static(user_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user or not user.app_name:
            return
        site_name = f"{user.app_name}-static"
        ns = f"tenant-{user_id.hex[:8]}"
        apps = k8s.apps_v1()
        core = k8s.core_v1()
        custom = k8s.custom()
        for call in (
            lambda: apps.delete_namespaced_deployment(name=site_name, namespace=ns),
            lambda: core.delete_namespaced_service(name=site_name, namespace=ns),
            lambda: custom.delete_namespaced_custom_object(
                group="gateway.networking.k8s.io", version="v1", namespace=ns,
                plural="httproutes", name=site_name),
            lambda: custom.delete_namespaced_custom_object(
                group="gateway.networking.k8s.io", version="v1", namespace=ns,
                plural="httproutes", name=f"{site_name}-redirect"),
        ):
            try:
                call()
            except ApiException as e:
                if e.status != 404:
                    raise
        # {app}.kodeploy.com·커스텀 도메인이 서버로 복귀 (site_enabled=false 기준 재계산)
        _reconcile_route_hostnames(user)
    except ApiException:
        pass
    finally:
        db.close()


# BuildKit Job 이름 (template과 동일 규칙 — _wait_for_job/로그 조회 시 사용)
def _build_job_name(build_id: str, user_id_str: str) -> str:
    return f"build-{user_id_str[:8]}-{build_id}"


# 백그라운드 빌드 코루틴 (Job 생성 → 폴링 → 성공 시 배포 / 실패 시 로그 저장)
async def _run_build(
    build_id: str,
    initial_env: dict[str, str] | None = None,
    init_dump_token: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        build = crud.get_build(db, build_id)
        if not build:
            return
        if build.status == "cancelled":
            return

        def _check_cancelled() -> bool:
            db.refresh(build)
            return build.status == "cancelled"

        # 빌드 행위 영구 기록 (append-only — delete_app에도 안 지워짐).
        # seq = 이 유저의 N번째 빌드. 기록 테이블 카운트 기준이라 앱 삭제 후에도 이어진다.
        # started_at은 aware datetime 로컬 변수로 들고 있음 — commit 후 ORM 재로드되면
        # naive로 바뀌어 total_seconds 계산(aware-naive 빼기)이 깨지므로.
        started_at = datetime.now(timezone.utc)
        seq = (
            db.query(func.count(BuildRecord.id))
            .filter(BuildRecord.user_id == build.user_id)
            .scalar()
            or 0
        ) + 1
        record = BuildRecord(
            build_id=build.build_id,
            user_id=build.user_id,
            seq=seq,
            app_name=build.app_name,
            runtime=build.runtime,
            build_mode=build.build_mode,
            started_at=started_at,
        )
        db.add(record)
        db.commit()

        try:
            build.status = "building"
            db.commit()

            # private repo면 이 빌드용 git 토큰 Secret 발급 (public이거나 App 미설정/미설치면 "" → 토큰 없이 clone).
            git_auth_secret = _provision_git_auth(build)

            # build_mode="detect" 해소 — Dockerfile 있으면 dockerfile / 없으면 auto(nixpacks).
            # GitHub tree API로 감지(깊이 3). private은 위에서 발급한 installation 토큰 캐시 재사용.
            if build.build_mode == "detect":
                mode, path = await asyncio.to_thread(_detect_build, build)
                build.build_mode = mode
                if mode == "dockerfile":
                    build.dockerfile_path = path
                else:                          # auto — 감지한 nixpacks 디렉토리를 project_path로
                    build.project_path = path
                db.commit()

            # 빌드 시작 전에 Dockerfile 텍스트를 DB에 보존 (UI 노출 + AI 분석용).
            # dockerfile 모드: GitHub raw fetch. auto 모드: 빌드 후 init container 로그에서 추출.
            if build.build_mode == "dockerfile":
                content = await asyncio.to_thread(
                    _fetch_github_raw, build.repo_url, build.branch, build.dockerfile_path
                )
                if content is not None:
                    build.dockerfile_content = content
                    db.commit()

            if build.runtime == "static":
                # 플랫폼 생성 Dockerfile — repo엔 없음. 빌드 전에 DB 보존 (UI 노출 + 재현성).
                dockerfile_text = manifests.static_dockerfile(
                    build.build_cmd or "",
                    build.output_dir or "",
                    build_env=json.loads(build.build_env) if build.build_env else None,
                )
                build.dockerfile_content = dockerfile_text
                db.commit()
                job = manifests.static_buildkit_job(
                    build_id=build.build_id,
                    user_id=build.user_id_str,
                    image=build.image,
                    repo_url=build.repo_url,
                    branch=build.branch,
                    dockerfile_text=dockerfile_text,
                    project_path=build.project_path,
                    git_auth_secret=git_auth_secret,
                )
            elif build.build_mode == "auto":
                job = manifests.nixpacks_buildkit_job(
                    build_id=build.build_id,
                    user_id=build.user_id_str,
                    image=build.image,
                    repo_url=build.repo_url,
                    branch=build.branch,
                    project_path=build.project_path,
                    git_auth_secret=git_auth_secret,
                )
            else:
                # dockerfile_path를 subdir + filename으로 분리 (BuildKit context를 subdir로 좁힘).
                dockerfile_subdir, dockerfile_filename = os.path.split(
                    build.dockerfile_path or "Dockerfile"
                )
                job = manifests.buildkit_job(
                    build_id=build.build_id,
                    user_id=build.user_id_str,
                    image=build.image,
                    repo_url=build.repo_url,
                    branch=build.branch,
                    dockerfile_subdir=dockerfile_subdir,
                    dockerfile_filename=dockerfile_filename,
                    git_auth_secret=git_auth_secret,
                )

            k8s.batch_v1().create_namespaced_job(
                namespace=config.BUILD_NAMESPACE, body=job
            )

            job_name = _build_job_name(build.build_id, build.user_id_str)
            success = await _wait_for_job(job_name)

            # 단계별 소요시간 기록 — Job 종료 직후 Pod 컨테이너 상태에서 추출.
            phases = _get_build_phase_seconds(build.build_id)
            record.nixpacks_seconds = phases.get("nixpacks_seconds")
            record.buildkit_seconds = phases.get("buildkit_seconds")

            # auto 모드: init container 로그도 함께. 빌드 실패가 init 단계(nixpacks)일 때
            # buildkit 로그는 비어있고 진짜 원인은 init에 있음. UI에서 디버깅 가능하게 둘 다 노출.
            if build.build_mode == "auto":
                init_logs = _get_init_container_logs(build.build_id, "nixpacks")
                main_logs = _get_job_logs(build.build_id)
                parts = []
                if init_logs:
                    parts.append(f"=== nixpacks (init) ===\n{init_logs}")
                if main_logs:
                    parts.append(f"=== buildkit (main) ===\n{main_logs}")
                build.logs = "\n\n".join(parts) if parts else ""

                if init_logs:
                    extracted = _extract_between(
                        init_logs,
                        "===KODEPLOY_DOCKERFILE_START===",
                        "===KODEPLOY_DOCKERFILE_END===",
                    )
                    if extracted:
                        build.dockerfile_content = extracted
                        db.commit()
            elif build.runtime == "static":
                # clone(init) 실패 시 main 로그가 비므로 둘 다 — auto 모드와 같은 이유.
                init_logs = _get_init_container_logs(build.build_id, "clone")
                main_logs = _get_job_logs(build.build_id)
                parts = []
                if init_logs:
                    parts.append(f"=== clone (init) ===\n{init_logs}")
                if main_logs:
                    parts.append(f"=== buildkit (main) ===\n{main_logs}")
                build.logs = "\n\n".join(parts) if parts else ""
            else:
                build.logs = _get_job_logs(build.build_id)

            db.commit()

            if not success:
                build.status = "failed"
                build.error = "빌드 실패"
                db.commit()
                return

            if _check_cancelled():
                return

            build.status = "deploying"
            db.commit()
            _ensure_tenant_ns(build)

            # deps(환경변수/DB/Redis/스토리지/초기 덤프)는 서버 슬롯 선언 — static 빌드가
            # 건드리면 같은 ns의 서버 deps를 teardown해 버리므로 (db_type=none) 반드시 skip.
            if build.runtime != "static":
                # 사용자가 폼에서 보낸 환경변수 — ns 만든 직후, Deployment apply 전.
                # Deployment는 아직 없을 수 있어서 set_env 안의 annotation patch는 404 swallow.
                # Pod이 새로 만들어질 때 Secret 자연 mount.
                if initial_env:
                    try:
                        env_module.set_env(build.tenant_id, build.app_name, initial_env)
                    except ValueError as e:
                        build.error = f"환경변수 검증 실패: {e}"
                        db.commit()

                # DB 토글 — 선택된 db (mysql/postgres) 프로비저닝 + 다른 db 정리.
                # PVC/Secret은 보존 — 같은 db로 다시 토글 시 데이터 자연 복원.
                _apply_db(build, build.db_type or "none")
                _apply_redis(build)
                _apply_storage(build)
                _apply_volume(build)  # 영속저장소 local — PVC 생성(있을 때). Deployment apply 전에 (마운트 대상 보장)

                # 초기 데이터 자동 복원 — 폼에서 .sql(.gz) 첨부 + DB(mysql/postgres) 선택 시.
                # 앱이 채워진 DB 위에서 시작하도록 Deployment apply 전에 DB Ready 대기 후 복원.
                if init_dump_token:
                    if build.db_type in ("mysql", "postgres"):
                        if await snapshots.wait_db_ready(build.tenant_id, build.db_type):
                            try:
                                await snapshots.restore_staged(
                                    build.tenant_id, init_dump_token
                                )
                            except snapshots.SnapshotError as e:
                                build.error = f"초기 데이터 복원 실패: {e}"
                                db.commit()
                        else:
                            snapshots.discard_staged(init_dump_token)
                            build.error = "초기 데이터 복원 실패: DB 준비 타임아웃"
                            db.commit()
                    else:
                        # DB 없는데 토큰만 온 경우 — 임시 파일만 정리.
                        snapshots.discard_staged(init_dump_token)

            # 슬롯 규칙으로 이 빌드 route의 hostnames 계산 (User.site_enabled가 진실원).
            owner = db.query(User).filter_by(id=build.user_id).first()
            if not owner:
                return  # 빌드 도중 유저 삭제 — 배포 의미 없음
            if build.runtime == "static" and not owner.site_enabled:
                return  # 빌드 도중 정적 슬롯 해제 — teardown이 정리 중, apply하면 부활시킴
            server_hosts, site_hosts = _slot_hostnames(owner)
            hostnames = site_hosts if build.runtime == "static" else server_hosts

            _apply_deployment(build, hostnames)

            # 전체 route(서버 쌍 + 정적 쌍) hostnames reconcile — 슬롯 전환·커스텀 도메인·
            # 수동 drift가 이 시점에 DB 선언값으로 복원된다.
            _reconcile_route_hostnames(owner)

            ready = await _wait_for_rollout(build.app_name, build.tenant_id)
            if _check_cancelled():
                return
            if ready:
                build.status = "running"
            else:
                build.status = "failed"
                build.error = "Pod 시작 실패 (타임아웃)"
            db.commit()

        except Exception as e:
            db.rollback()
            db.refresh(build)
            if build.status != "cancelled":
                build.status = "failed"
                build.error = f"오케스트레이션 에러: {e}"
                db.commit()
        finally:
            # 어떤 경로(성공/실패/취소/예외)로 끝나든 기록 마감.
            # 기록 실패가 빌드 흐름이나 세션 정리를 막지 않게 자체 예외는 삼킨다.
            try:
                finished_at = datetime.now(timezone.utc)
                record.finished_at = finished_at
                record.total_seconds = (finished_at - started_at).total_seconds()
                record.status = build.status
                record.error = build.error
                db.commit()
            except Exception:
                db.rollback()
            # private repo 토큰 Secret 정리 (어떤 경로로 끝나든 — 토큰 자체도 1h 만료라 이중 안전).
            try:
                _cleanup_git_auth(build_id)
            except ApiException:
                pass
    except Exception:
        pass
    finally:
        db.close()


# Job 완료까지 3초 간격 폴링 (성공 True, 실패/타임아웃 False)
async def _wait_for_job(job_name: str) -> bool:
    timeout = config.BUILD_TIMEOUT_SECONDS
    deadline = time.time() + timeout
    batch = k8s.batch_v1()
    while time.time() < deadline:
        job = batch.read_namespaced_job_status(
            name=job_name, namespace=config.BUILD_NAMESPACE
        )
        if job.status.succeeded:
            return True
        if job.status.failed:
            return False
        await asyncio.sleep(3)
    return False


ROLLOUT_TIMEOUT_SECONDS = 900


async def _wait_for_rollout(app_name: str, namespace: str) -> bool:
    deadline = time.time() + ROLLOUT_TIMEOUT_SECONDS
    apps = k8s.apps_v1()
    while time.time() < deadline:
        try:
            dep = apps.read_namespaced_deployment_status(
                name=app_name, namespace=namespace
            )
        except ApiException:
            await asyncio.sleep(5)
            continue
        ready = dep.status.ready_replicas or 0
        desired = dep.spec.replicas or 1
        observed = dep.status.observed_generation or 0
        current = dep.metadata.generation or 0
        if ready >= desired and observed >= current:
            return True
        await asyncio.sleep(5)
    return False


# build-id 라벨로 BuildKit Pod 찾아 로그 조회 (main container 기본)
def _get_job_logs(build_id: str) -> str:
    core = k8s.core_v1()
    pods = core.list_namespaced_pod(
        namespace=config.BUILD_NAMESPACE,
        label_selector=f"build-id={build_id}",
    )
    if not pods.items:
        return ""
    pod_name = pods.items[0].metadata.name
    try:
        return core.read_namespaced_pod_log(
            name=pod_name, namespace=config.BUILD_NAMESPACE
        )
    except ApiException as e:
        return f"로그 조회 실패: {e}"


# 빌드 Pod의 컨테이너 종료 정보에서 단계별 소요시간 추출 (BuildRecord용).
# nixpacks=init container(auto 모드만) / buildkit=main container.
# 컨테이너가 아직 안 끝났거나(타임아웃) Pod이 없으면 해당 값 생략 — 기록은 best-effort.
def _get_build_phase_seconds(build_id: str) -> dict:
    core = k8s.core_v1()
    try:
        pods = core.list_namespaced_pod(
            namespace=config.BUILD_NAMESPACE,
            label_selector=f"build-id={build_id}",
        )
    except ApiException:
        return {}
    if not pods.items:
        return {}
    status = pods.items[0].status

    def terminated_seconds(statuses, name: str) -> float | None:
        for cs in statuses or []:
            if cs.name == name and cs.state and cs.state.terminated:
                t = cs.state.terminated
                if t.started_at and t.finished_at:
                    return (t.finished_at - t.started_at).total_seconds()
        return None

    out = {}
    nix = terminated_seconds(status.init_container_statuses, "nixpacks")
    if nix is not None:
        out["nixpacks_seconds"] = nix
    bk = terminated_seconds(status.container_statuses, "buildkit")
    if bk is not None:
        out["buildkit_seconds"] = bk
    return out


# 같은 Pod의 특정 init container 로그 조회 (auto 모드의 nixpacks container용)
def _get_init_container_logs(build_id: str, container_name: str) -> str:
    core = k8s.core_v1()
    pods = core.list_namespaced_pod(
        namespace=config.BUILD_NAMESPACE,
        label_selector=f"build-id={build_id}",
    )
    if not pods.items:
        return ""
    pod_name = pods.items[0].metadata.name
    try:
        return core.read_namespaced_pod_log(
            name=pod_name,
            namespace=config.BUILD_NAMESPACE,
            container=container_name,
        )
    except ApiException:
        return ""


# 텍스트에서 marker 사이 추출 — nixpacks init container 로그 파싱용
def _extract_between(text: str, start: str, end: str) -> str | None:
    s = text.find(start)
    if s < 0:
        return None
    s += len(start)
    e = text.find(end, s)
    if e < 0:
        return None
    return text[s:e].strip("\n")


# 테넌트 ns 프로비저닝 (Namespace + ghcr-auth Secret). idempotent create(409 skip).
# ResourceQuota는 제거됨 — API-mediated 구조에선 컴포넌트·limit이 고정이라 ns 상한이
# 구조적으로 결정되고, 슬롯별 배포에서 quota 덮어쓰기 사고만 만들었음 (runtimes.py 주석).
def _ensure_tenant_ns(build: Build) -> None:
    if build.user_id is None:
        return

    core = k8s.core_v1()
    ns = build.tenant_id

    # 직전 delete_app으로 ns가 terminating 중일 수 있음 — 사라질 때까지 잠시 대기.
    # 60초 안에 안 끝나면 그대로 진행해서 create_namespace의 에러로 표면화.
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            existing = core.read_namespace(name=ns)
        except ApiException as e:
            if e.status == 404:
                break  # 사라짐 — 새로 만들면 됨
            raise
        if existing.status.phase != "Terminating":
            break  # Active — 재사용
        time.sleep(2)

    secret = core.read_namespaced_secret(
        name=config.GHCR_AUTH_SECRET_NAME,
        namespace=config.BUILD_NAMESPACE,
    )
    dockerconfigjson_b64 = secret.data[".dockerconfigjson"]

    docs = manifests.tenant(
        tenant_id=ns,
        user_id=build.user_id_str,
        dockerconfigjson_b64=dockerconfigjson_b64,
    )

    for doc in docs:
        kind = doc["kind"]
        try:
            if kind == "Namespace":
                core.create_namespace(body=doc)
            elif kind == "Secret":
                core.create_namespaced_secret(namespace=ns, body=doc)
        except ApiException as e:
            if e.status != 409:
                raise

    # 옛 ResourceQuota 잔재 정리 — 라이브 테넌트에 남은 quota가 admission을 계속 물면
    # 정체불명 배포 실패가 되므로, 배포마다 멱등 delete (테넌트별 자가 정리).
    try:
        core.delete_namespaced_resource_quota(name=ns, namespace=ns)
    except ApiException as e:
        if e.status != 404:
            raise


# 선택된 db (mysql / postgres) 같은 ns에 프로비저닝. 409(이미 존재)는 skip.
# 재배포 시 다시 호출돼도 안전 — 첫 호출의 비번 + PVC가 영구 유지되고,
# 옛 PVC가 남아있으면 새 StatefulSet이 자동 재바인딩해서 데이터 자연 복원.
def _ensure_one_db(build: Build, db_type: str) -> None:
    if db_type not in ("mysql", "postgres"):
        return
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id

    docs = (
        manifests.mysql(tenant_id=ns, user_id=build.user_id_str)
        if db_type == "mysql"
        else manifests.postgres(tenant_id=ns, user_id=build.user_id_str)
    )
    for doc in docs:
        kind = doc["kind"]
        try:
            if kind == "Secret":
                core.create_namespaced_secret(namespace=ns, body=doc)
            elif kind == "Service":
                core.create_namespaced_service(namespace=ns, body=doc)
            elif kind == "StatefulSet":
                apps.create_namespaced_stateful_set(namespace=ns, body=doc)
        except ApiException as e:
            if e.status != 409:
                raise


# 특정 db의 StatefulSet + Service만 삭제. PVC/Secret은 의도적으로 보존.
# 다시 그 db로 토글하면 새 StatefulSet이 옛 PVC + 옛 Secret에 자동 바인딩 → 복원.
# ns 기반 — 서버 슬롯 teardown(_teardown_server)에서도 Build 없이 호출 가능.
def _teardown_one_db(ns: str, db_type: str) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    for delete_call in (
        lambda: apps.delete_namespaced_stateful_set(name=db_type, namespace=ns),
        lambda: core.delete_namespaced_service(name=db_type, namespace=ns),
    ):
        try:
            delete_call()
        except ApiException as e:
            if e.status != 404:
                raise


# db_type 적용 — 선택된 db 프로비저닝 + 다른 db (있다면) 정리.
def _apply_db(build: Build, db_type: str) -> None:
    for candidate in ("mysql", "postgres"):
        if candidate == db_type:
            _ensure_one_db(build, candidate)
        else:
            _teardown_one_db(build.tenant_id, candidate)


def _teardown_redis(ns: str) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    for delete_call in (
        lambda: apps.delete_namespaced_deployment(name="redis", namespace=ns),
        lambda: core.delete_namespaced_service(name="redis", namespace=ns),
    ):
        try:
            delete_call()
        except ApiException as e:
            if e.status != 404:
                raise


def _apply_redis(build: Build) -> None:
    ns = build.tenant_id
    if not build.use_redis:
        _teardown_redis(ns)
        return
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    docs = manifests.redis(tenant_id=ns, user_id=build.user_id_str)
    for doc in docs:
        kind = doc["kind"]
        try:
            if kind == "Secret":
                core.create_namespaced_secret(namespace=ns, body=doc)
            elif kind == "Service":
                core.create_namespaced_service(namespace=ns, body=doc)
            elif kind == "Deployment":
                apps.create_namespaced_deployment(namespace=ns, body=doc)
        except ApiException as e:
            if e.status != 409:
                raise


# r2-secret(테넌트 ns)에서 S3 자격증명 env를 dict로 읽음. storage 미활성이면 None.
# r2.list_objects/delete_object가 이 env로 버킷에 직접 S3 호출한다 (앱당 스코프 토큰 재사용).
def _read_storage_env(ns: str) -> dict | None:
    try:
        secret = k8s.core_v1().read_namespaced_secret(name="r2-secret", namespace=ns)
    except ApiException as e:
        if e.status == 404:
            return None
        raise
    data = secret.data or {}
    return {k: base64.b64decode(v).decode("utf-8") for k, v in data.items()}


# 앱 버킷 객체 목록 — router가 호출. tenant ns는 user.id에서 파생되므로 격리 자동.
def list_storage_objects(user: User, token: str | None = None) -> dict:
    if not user.app_name:
        raise ValueError("배포된 앱이 없습니다")
    env = _read_storage_env(f"tenant-{user.id.hex[:8]}")
    if not env:
        raise ValueError("오브젝트 스토리지가 활성화돼 있지 않습니다")
    try:
        return r2.list_objects(env, continuation_token=token)
    except r2.R2Error as e:
        raise ValueError(str(e))


# 앱 버킷 객체 1개 삭제 — router가 호출.
def delete_storage_object(user: User, key: str) -> None:
    if not user.app_name:
        raise ValueError("배포된 앱이 없습니다")
    env = _read_storage_env(f"tenant-{user.id.hex[:8]}")
    if not env:
        raise ValueError("오브젝트 스토리지가 활성화돼 있지 않습니다")
    try:
        r2.delete_object(env, key)
    except r2.R2Error as e:
        raise ValueError(str(e))


# 현재 ns의 r2-secret 주석에서 R2 토큰 id 조회 (없으면 None). 정리/회전 시 사용.
def _read_r2_token_id(ns: str) -> str | None:
    try:
        secret = k8s.core_v1().read_namespaced_secret(name="r2-secret", namespace=ns)
    except ApiException as e:
        if e.status == 404:
            return None
        raise
    annotations = (secret.metadata.annotations or {}) if secret.metadata else {}
    return annotations.get("kodeploy.com/r2-token-id")


# 스토리지 토글 off — r2-secret 삭제 + 토큰 revoke. 버킷(데이터)은 보존.
# ns 기반 — 서버 슬롯 teardown에서도 호출.
def _teardown_storage(ns: str) -> None:
    old_token_id = _read_r2_token_id(ns)
    try:
        k8s.core_v1().delete_namespaced_secret(name="r2-secret", namespace=ns)
    except ApiException as e:
        if e.status != 404:
            raise
    if old_token_id:
        r2.deprovision(old_token_id, bucket=None)


# R2 스토리지 토글 — mysql/redis와 같은 철학이되 외부(CF) 리소스라 흐름이 다르다.
# ON  : CF API로 버킷(idempotent) + 새 bucket-scoped 토큰 발급 → r2-secret 생성/교체.
#       재배포마다 토큰을 새로 발급하고 옛 토큰은 revoke (자격증명 회전).
# OFF : r2-secret 삭제 + 토큰 revoke. 버킷(데이터)은 보존 (mysql PVC 보존과 동일 정책).
def _apply_storage(build: Build) -> None:
    if build.user_id is None:
        return
    if not build.use_storage:
        _teardown_storage(build.tenant_id)
        return
    core = k8s.core_v1()
    ns = build.tenant_id
    old_token_id = _read_r2_token_id(ns)

    # CF API로 버킷+토큰 프로비저닝 (실패 시 R2Error → 배포 실패로 표면화).
    env_vars, token_id = r2.provision(build.app_name)
    docs = manifests.storage(
        tenant_id=ns,
        user_id=build.user_id_str,
        env=env_vars,
        token_id=token_id,
    )
    for doc in docs:  # Secret 1개
        try:
            core.read_namespaced_secret(name="r2-secret", namespace=ns)
            core.replace_namespaced_secret(
                name="r2-secret", namespace=ns, body=doc
            )
        except ApiException as e:
            if e.status != 404:
                raise
            core.create_namespaced_secret(namespace=ns, body=doc)
    # 자격증명 회전 — 옛 토큰이 새 것과 다르면 revoke (버킷은 그대로).
    if old_token_id and old_token_id != token_id:
        r2.deprovision(old_token_id, bucket=None)


# 로컬 볼륨 PVC 이름 — 앱당 1개 (1유저=1앱). Deployment 볼륨 마운트가 이 이름을 참조.
def _volume_pvc_name(app_name: str) -> str:
    return f"{app_name}-data"


# 로컬 영속 볼륨(PVC) 보장 — 영속저장소 "local" 모드. mysql/redis/storage와 같은 위치의 토글 함수.
# 활성(volume_mount_path 있음)이면 PVC 생성(idempotent, 409 skip). 비활성이면 아무것도 안 함 —
# PVC는 보존하고 Deployment 재렌더가 마운트를 떼낸다 (mysql PVC 보존과 동일 철학).
# 삭제는 ns 삭제(delete_app)에 위임 — R2처럼 외부 리소스가 아니라 ns cascade로 정리됨.
def _apply_volume(build: Build) -> None:
    if build.user_id is None or not build.volume_mount_path:
        return
    docs = manifests.volume(
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        app_name=build.app_name,
        storage_class=build.volume_storage_class or "local-path",
        size=build.volume_size or "5Gi",
    )
    core = k8s.core_v1()
    for doc in docs:  # PVC 1개
        try:
            core.create_namespaced_persistent_volume_claim(
                namespace=build.tenant_id, body=doc
            )
        except ApiException as e:
            if e.status != 409:  # 이미 존재 — 데이터 보존 (mysql StatefulSet 409 skip과 동일)
                raise


# hostnames: 이 슬롯 route에 걸 호스트 목록 (_slot_hostnames로 계산해 전달).
def _apply_deployment(build: Build, hostnames: list[str]) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id

    deploy = manifests.deployment(
        runtime=build.runtime,
        app_name=build.app_name,
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        image=build.image,
        port=build.port,
        volume_mount_path=build.volume_mount_path or "",  # 영속저장소 local — 있으면 PVC 마운트 블록 렌더
        pvc_name=_volume_pvc_name(build.app_name),
    )
    svc = manifests.service(
        app_name=build.app_name,
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        port=build.port,
    )

    # Deployment 동기화:
    # - 같은 런타임·포트 재배포(대부분): image만 strategic merge patch — 최소 변경.
    # - 런타임/포트가 바뀐 재배포: patch는 probe·리소스에 옛 템플릿이 남아
    #   (예: python 8000 probe인 채 nginx 8080 컨테이너 → 기동 불능) 새 manifest로 통째 replace.
    try:
        existing = apps.read_namespaced_deployment(name=build.app_name, namespace=ns)
        existing_runtime = (existing.metadata.labels or {}).get("runtime")
        containers = existing.spec.template.spec.containers or []
        existing_ports = containers[0].ports if containers else None
        existing_port = existing_ports[0].container_port if existing_ports else None
        # 로컬 볼륨 마운트 드리프트 감지 — 토글 on/off·mount_path 변경은 image-only patch로 반영
        # 안 됨(strategic patch는 volume을 추가만 하고 제거를 못 함). 다르면 통째 replace로 정합.
        existing_mount = next(
            (vm.mount_path for vm in (containers[0].volume_mounts or []) if vm.name == "data"),
            None,
        ) if containers else None
        desired_mount = build.volume_mount_path or None
        if (
            existing_runtime != build.runtime
            or existing_port != build.port
            or existing_mount != desired_mount
        ):
            # replace(PUT)는 optimistic concurrency용 resourceVersion 필수
            deploy["metadata"]["resourceVersion"] = existing.metadata.resource_version
            apps.replace_namespaced_deployment(
                name=build.app_name, namespace=ns, body=deploy,
            )
        else:
            deploy_patch = {
                "spec": {
                    "template": {
                        "spec": {
                            "containers": [
                                {
                                    "name": "app",
                                    "image": build.image,
                                    "ports": [{"containerPort": build.port}],
                                }
                            ]
                        }
                    }
                }
            }
            apps.patch_namespaced_deployment(
                name=build.app_name,
                namespace=ns,
                body=deploy_patch,
            )
    except ApiException as e:
        if e.status != 404:
            raise
        apps.create_namespaced_deployment(namespace=ns, body=deploy)

    # Service: strategic merge patch (clusterIP/selector 등은 건드리지 않음)
    svc_patch = {
        "spec": {
            "ports": [
                {
                    "port": build.port,
                    "targetPort": build.port,
                    "protocol": "TCP",
                }
            ]
        }
    }
    try:
        core.read_namespaced_service(name=build.app_name, namespace=ns)
        core.patch_namespaced_service(
            name=build.app_name,
            namespace=ns,
            body=svc_patch,
        )
    except ApiException as e:
        if e.status != 404:
            raise
        core.create_namespaced_service(namespace=ns, body=svc)

    # HTTPRoute: {app_name}.kodeploy.com → Service. 없으면 create, 있으면 rules만 동기화 —
    # backendRef 포트(런타임 전환 시 변경)·origin-verify 헤더매칭 드리프트가 현재 렌더값으로 복원된다.
    # hostnames는 건드리지 않음 (_set_app_route_hostnames의 reconcile이 별도 관리).
    routes = manifests.httproute(
        app_name=build.app_name,
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        port=build.port,
        hostnames=hostnames,
    )
    custom = k8s.custom()
    for route in routes:
        try:
            custom.create_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=ns,
                plural="httproutes",
                body=route,
            )
        except ApiException as e:
            if e.status != 409:
                raise
            custom.patch_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=ns,
                plural="httproutes",
                name=route["metadata"]["name"],
                body={"spec": {"rules": route["spec"]["rules"]}},
            )

    # Calico NetworkPolicy (per-tenant): 같은 ns + Envoy ingress 허용.
    # GlobalNetworkPolicy(order 200)가 DNS허용 + 사설대역Deny + 인터넷허용 담당.
    calico_pol = manifests.networkpolicy(tenant_id=build.tenant_id)
    try:
        custom.create_namespaced_custom_object(
            group="projectcalico.org",
            version="v3",
            namespace=ns,
            plural="networkpolicies",
            body=calico_pol,
        )
    except ApiException as e:
        if e.status != 409:
            raise


# --- 커스텀 도메인 (CF for SaaS custom hostname) -----------------------------
# domains.py(CF API)와 K8s HTTPRoute를 잇는 오케스트레이션 (r2/_apply_storage와 같은 위치).
# User엔 도메인+status만 저장(컬럼 2개), CF id는 매번 이름으로 lookup(domains.find).

_DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)([a-z0-9](?:[-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}$"
)

# Public Suffix List (패키지 동봉 스냅샷 — 네트워크 호출 없음).
# apex 판정용: privatesuffix(d)가 d 자신이면 등록 도메인(apex), 부모면 서브도메인.
# 라벨 수 세기(<3)는 co.kr 같은 복합 TLD에 구멍이 있어 PSL로 판정한다
# (example.co.kr은 라벨 3개지만 apex).
_PSL = PublicSuffixList()


def _normalize_domain(domain: str) -> str:
    d = (domain or "").strip().lower().rstrip(".")
    if not _DOMAIN_RE.match(d):
        raise ValueError("올바른 도메인 형식이 아닙니다 (예: app.example.com)")
    if d == "kodeploy.com" or d.endswith(".kodeploy.com"):
        raise ValueError("kodeploy.com 하위 도메인은 자동 제공되므로 커스텀 도메인으로 못 씁니다")
    return d


# User.extra_hostnames(콤마 구분 텍스트) → 리스트. 운영자가 DB에 직접 등록하는 값.
def _extra_hostnames(user: User) -> list[str]:
    raw = user.extra_hostnames or ""
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


# 슬롯 규칙에 따른 hostname 분배 — (서버 호스트들, 정적 호스트들) 반환.
# 정적 있음: {app}=정적(+커스텀 도메인+extra), {app}-api=서버
# 정적 없음: 서버가 {app}+{app}-api(+커스텀 도메인+extra), 정적은 빈 리스트
# -api를 정적 유무와 무관하게 항상 걸어두는 이유: 나중에 정적을 켜서 {app}이 정적으로
# 넘어가도 서버 주소({app}-api)는 처음부터 유효했던 주소라 API 소비자가 안 깨진다.
def _slot_hostnames(user: User) -> tuple[list[str], list[str]]:
    app = user.app_name
    extras = _extra_hostnames(user)
    custom_domain = [user.custom_domain] if user.custom_domain else []
    if user.site_enabled:
        return (
            [f"{app}-api.kodeploy.com"],
            [f"{app}.kodeploy.com", *extras, *custom_domain],
        )
    return (
        [f"{app}.kodeploy.com", f"{app}-api.kodeploy.com", *extras, *custom_domain],
        [],
    )


# 앱의 모든 route(서버 쌍 + 정적 쌍) hostnames를 슬롯 규칙으로 통째 set (authoritative
# reconcile). DB(User)가 유일한 진실원 — kubectl 수동 drift는 다음 갱신 때 복원된다.
# 특수 hostname이 필요하면 patch가 아니라 extra_hostnames에 등록할 것.
# 없는 route는 404 skip (해당 슬롯 미배포/teardown 중 — 정상).
def _reconcile_route_hostnames(user: User) -> None:
    if not user.app_name:
        return
    tenant_id = f"tenant-{user.id.hex[:8]}"
    server_hosts, site_hosts = _slot_hostnames(user)
    site_name = f"{user.app_name}-static"
    targets = [
        (user.app_name, server_hosts),
        (f"{user.app_name}-redirect", server_hosts),
        (site_name, site_hosts),
        (f"{site_name}-redirect", site_hosts),
    ]
    custom = k8s.custom()
    for route_name, hostnames in targets:
        if not hostnames:
            continue  # 정적 슬롯 비활성 — 그 route는 _teardown_static이 삭제 (빈 hostnames patch는 invalid)
        try:
            custom.patch_namespaced_custom_object(
                group="gateway.networking.k8s.io",
                version="v1",
                namespace=tenant_id,
                plural="httproutes",
                name=route_name,
                body={"spec": {"hostnames": hostnames}},
            )
        except ApiException as e:
            if e.status != 404:
                raise


# 커스텀 도메인 연결/변경 — CF custom hostname 생성 + User 저장 + 앱 route에 hostname 주입.
def set_custom_domain(db: Session, user: User, domain: str) -> dict:
    if not user.app_name:
        raise ValueError("먼저 앱을 배포한 후 커스텀 도메인을 연결할 수 있습니다")
    if not domains.is_configured():
        raise ValueError("커스텀 도메인이 서버에 설정되지 않았습니다")
    domain = _normalize_domain(domain)

    # 서브도메인 전용 — 루트(apex) 도메인은 CNAME 위임이 안 돼 CF for SaaS로 활성화 불가.
    # PSL 기반 판정: privatesuffix == 자기 자신이면 apex (example.com, example.co.kr 모두),
    # None이면 공용 suffix 자체(co.kr 등) — 둘 다 거부. 통과하면 진짜 서브도메인.
    registrable = _PSL.privatesuffix(domain)
    if registrable is None:
        raise ValueError("올바른 도메인 형식이 아닙니다 (예: app.example.com)")
    if registrable == domain:
        raise ValueError("서브도메인만 연결할 수 있어요 (예: app.example.com). 루트 도메인은 미지원입니다")

    other = (
        db.query(User)
        .filter(User.custom_domain == domain, User.id != user.id)
        .first()
    )
    if other:
        raise ValueError(f"이미 사용 중인 도메인: {domain}")

    # 도메인 변경이면 옛 CF custom hostname 정리
    if user.custom_domain and user.custom_domain != domain:
        domains.delete(user.custom_domain)

    try:
        summary = domains.create(domain)
    except domains.DomainError as e:
        raise ValueError(str(e))

    user.custom_domain = domain
    user.custom_domain_status = "active" if summary.get("status") == "active" else "pending"
    db.commit()

    # DB 갱신 후 reconcile — 슬롯 규칙대로 정적(있으면) 또는 서버 route에 주입.
    # 옛 도메인은 리스트에서 빠지는 걸로 자연 제거됨.
    _reconcile_route_hostnames(user)
    return {
        "domain": user.custom_domain,
        "status": user.custom_domain_status,
        "ssl_status": summary.get("ssl_status"),
    }


# CF에서 검증/cert 상태를 다시 읽어 User.custom_domain_status 갱신 (UI 폴링).
def refresh_custom_domain_status(db: Session, user: User) -> dict:
    if not user.custom_domain:
        return {"domain": None, "status": None, "ssl_status": None}
    summary = None
    try:
        summary = domains.get_status(user.custom_domain)
    except domains.DomainError:
        pass
    if summary:
        new_status = "active" if summary.get("status") == "active" else "pending"
        if new_status != user.custom_domain_status:
            user.custom_domain_status = new_status
            db.commit()
    return {
        "domain": user.custom_domain,
        "status": user.custom_domain_status,
        "ssl_status": summary.get("ssl_status") if summary else None,
    }


# 커스텀 도메인 해제 — User 클리어 후 reconcile(route에서 자연 제거) + CF custom hostname 삭제.
def clear_custom_domain(db: Session, user: User) -> None:
    if not user.custom_domain:
        return
    domain = user.custom_domain
    user.custom_domain = None
    user.custom_domain_status = None
    db.commit()
    if user.app_name:
        try:
            _reconcile_route_hostnames(user)
        except ApiException:
            pass
    domains.delete(domain)

