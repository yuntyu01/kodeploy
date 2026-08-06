"""GitHub API 연동 — raw fetch · 빌드 방식 감지 · 최근 커밋 캐시."""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from app.auth import github_app
from app.auth.model import User
from app.deploy.model import Build
from app.shared.db import SessionLocal

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
# 런타임별로 나눠, 감지 시 유저가 선택한 런타임의 마커를 우선한다 — 풀스택 repo에서
# frontend의 package.json이 백엔드 감지를 가로채지 않게 (역방향도 동일).
_RUNTIME_MARKERS = {
    "python": frozenset({"requirements.txt", "pyproject.toml", "Pipfile", "setup.py"}),
    "java": frozenset({"pom.xml", "build.gradle", "build.gradle.kts"}),
    "php": frozenset({"composer.json"}),
    "javascript": frozenset({"package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"}),
    # --- 미지원 런타임 (지원 추가 시 활성화) ---
    # "go": frozenset({"go.mod"}),
    # "ruby": frozenset({"Gemfile"}),
    # "rust": frozenset({"Cargo.toml"}),
    # "elixir": frozenset({"mix.exs"}),
}
_NIXPACKS_MARKERS = frozenset().union(*_RUNTIME_MARKERS.values())


# build_mode="detect" 해소 — GitHub tree API로 빌드 방식 + 경로를 한 번에 감지 (깊이 3까지).
#   1) Dockerfile 있으면        → ("dockerfile", 그 경로)
#   2) 없고 nixpacks 마커 있으면 → ("auto", 그 디렉토리)  ← 모노레포 서브디렉토리 자동
#   3) 둘 다 없으면             → ("auto", project_path 그대로) — nixpacks가 root에서 시도
# project_path 하위 우선, 선택 런타임 마커 우선, root에 가까운 것 우선.
# private은 installation 토큰. fallback 아님(존재 기반).
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

    chosen = _choose_build_target(data.get("tree", []), build.project_path, build.runtime)
    return chosen if chosen else fallback


# tree(파싱된 GitHub tree API 응답)에서 빌드 방식+경로 선택 — 순수 함수.
# Dockerfile > 선택 런타임의 마커 > 그 외 마커, 각각 root 가까운 것 우선. 없으면 None.
def _choose_build_target(
    tree: "list[dict]", project_path: "str | None", runtime: str,
) -> "tuple[str, str] | None":
    prefix = (project_path or "").strip("/")

    def in_scope(p: str) -> bool:
        return not prefix or p == prefix or p.startswith(f"{prefix}/")

    dockerfiles, markers = [], []
    for item in tree:
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
        preferred = _RUNTIME_MARKERS.get(runtime, frozenset())
        markers.sort(
            key=lambda p: (p.rsplit("/", 1)[-1] not in preferred, p.count("/"))
        )
        best = markers[0]
        return ("auto", best.rsplit("/", 1)[0] if "/" in best else "")
    return None


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
