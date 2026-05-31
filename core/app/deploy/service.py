"""배포 오케스트레이션."""

import asyncio
import json
import os.path
import re
import time
import urllib.error
import urllib.request
import uuid

from kubernetes.client.exceptions import ApiException
from sqlalchemy.orm import Session

from app import config
from app.auth.model import User
from app.deploy import crud, env as env_module, manifests, r2, runtimes, snapshots
from app.deploy.model import Build
from app.shared import k8s
from app.shared.db import SessionLocal


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
}

# DNS-1123 label rule (K8s metadata.name + 서브도메인 둘 다 만족)
_NAME_PATTERN = re.compile(r"^[a-z]([-a-z0-9]*[a-z0-9])?$")
_NAME_MAX_LENGTH = 40


def _validate_name_format(name: str) -> None:
    if name.startswith("app-"):
        raise ValueError("'app-' prefix는 자동 생성용으로 예약돼 있음")
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
def get_app_status(user: User) -> dict:
    if not user.app_name:
        return {"status": "missing", "started_at": None}
    tenant_id = f"tenant-{user.id.hex[:8]}"
    core = k8s.core_v1()
    try:
        pods = core.list_namespaced_pod(
            namespace=tenant_id, label_selector=f"app={user.app_name}",
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
                reason = cs.state.waiting.reason or ""
                if reason in (
                    "CrashLoopBackOff",
                    "ImagePullBackOff",
                    "ErrImagePull",
                    "CreateContainerError",
                    "CreateContainerConfigError",
                ):
                    return {"status": "crashing", "started_at": started_at}
        return {"status": "pending", "started_at": started_at}

    if phase == "Failed":
        return {"status": "crashing", "started_at": started_at}

    for cs in pod.status.container_statuses or []:
        if cs.state and cs.state.waiting:
            reason = cs.state.waiting.reason or ""
            if reason in (
                "CrashLoopBackOff",
                "ImagePullBackOff",
                "ErrImagePull",
                "CreateContainerError",
                "CreateContainerConfigError",
            ):
                return {"status": "crashing", "started_at": started_at}
    return {"status": "pending", "started_at": started_at}


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

    # DB: builds 히스토리 + user.app_name 리셋. 다음 배포는 첫 배포 흐름으로 진입.
    db.query(Build).filter(Build.user_id == user.id).delete()
    user.app_name = None
    db.commit()


# 최근 커밋 조회 — public repo 한정 (unauthenticated GitHub API, IP당 60req/h).
# private repo 지원은 App installation token 도입 시 분기 추가.
# 실패는 빈 리스트로 swallow — UI에서 "없음" 표시되면 충분.
def fetch_recent_commits(
    repo_url: str, branch: str, per_page: int = 10,
) -> list[dict]:
    m = _GITHUB_REPO_PATTERN.match(repo_url.rstrip("/"))
    if not m:
        return []
    owner, repo = m.group(1), m.group(2)
    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?sha={branch}&per_page={per_page}"
    )
    try:
        req = urllib.request.Request(
            api_url,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "kodeploy",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return []
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
    return out


_ACTIVE_STATUSES = {"queued", "building", "built", "deploying"}


def _cancel_stale_builds(db: Session, user_id: uuid.UUID) -> None:
    stale = db.query(Build).filter(
        Build.user_id == user_id,
        Build.status.in_(_ACTIVE_STATUSES),
    ).all()
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


# Build row 생성 + 백그라운드 빌드 태스크 등록.
# user 객체로 받음 — _resolve_app_name이 user.app_name을 읽고/쓰기 위해.
async def start_build(
    db: Session,
    repo_url: str,
    runtime: str,
    user: User,
    name: str | None = None,
    branch: str = "main",
    port: int = 80,
    db_type: str = "none",
    use_redis: bool = False,
    use_storage: bool = False,
    build_mode: str = "dockerfile",
    dockerfile_path: str = "Dockerfile",
    project_path: str = "",
    env_vars: dict[str, str] | None = None,
    init_dump_token: str | None = None,
) -> Build:
    # storage 토글은 R2 설정이 갖춰졌을 때만 — 빌드 시작 전에 친절히 거절.
    if use_storage and not r2.is_configured():
        raise ValueError("오브젝트 스토리지(R2)가 서버에 설정되지 않았습니다")
    _cancel_stale_builds(db, user.id)
    repo_url = _normalize_repo_url(repo_url)
    build_id = uuid.uuid4().hex[:8]
    app_name = _resolve_app_name(name, repo_url, user, db)
    image = f"ghcr.io/{config.GHCR_USER}/{user.id.hex[:8]}/{app_name}:{build_id}"

    build = Build(
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
        build_mode=build_mode,
        dockerfile_path=dockerfile_path,
        project_path=project_path.strip("/"),  # 앞뒤 슬래시 정리 — manifest에서 ${PROJECT_PATH:+/$PROJECT_PATH}로 결합
    )
    build = crud.create_build(db, build)

    asyncio.create_task(_run_build(build_id, env_vars or {}, init_dump_token))
    return build


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

        try:
            # 빌드 시작 전에 Dockerfile 텍스트를 DB에 보존 (UI 노출 + AI 분석용).
            # dockerfile 모드: GitHub raw fetch. auto 모드: 빌드 후 init container 로그에서 추출.
            if build.build_mode == "dockerfile":
                content = await asyncio.to_thread(
                    _fetch_github_raw, build.repo_url, build.branch, build.dockerfile_path
                )
                if content is not None:
                    build.dockerfile_content = content
                    db.commit()

            build.status = "building"
            db.commit()

            if build.build_mode == "auto":
                job = manifests.nixpacks_buildkit_job(
                    build_id=build.build_id,
                    user_id=build.user_id_str,
                    image=build.image,
                    repo_url=build.repo_url,
                    branch=build.branch,
                    project_path=build.project_path,
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
                )

            k8s.batch_v1().create_namespaced_job(
                namespace=config.BUILD_NAMESPACE, body=job
            )

            job_name = _build_job_name(build.build_id, build.user_id_str)
            success = await _wait_for_job(job_name)

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

            _apply_deployment(build)

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


# 테넌트 ns 프로비저닝 (Namespace + ResourceQuota + ghcr-auth).
# Namespace/Secret은 idempotent create(409 skip), ResourceQuota는 patch로 갱신 가능.
# 이유: db_type 변경에 따라 mysql/postgres 컴포넌트가 quota에 합산되거나 빠질 수 있어 재배포 시 갱신 필요.
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

    # 선택된 db도 quota에 합산 — 재배포 시마다 현재 상태 반영
    db_type = build.db_type or "none"
    components = [build.runtime] + ([db_type] if db_type in ("mysql", "postgres") else [])
    if build.use_redis:
        components.append("redis")
    quota = runtimes.compute_quota(components)
    docs = manifests.tenant(
        tenant_id=ns,
        user_id=build.user_id_str,
        **quota,
        dockerconfigjson_b64=dockerconfigjson_b64,
    )

    for doc in docs:
        kind = doc["kind"]
        try:
            if kind == "Namespace":
                core.create_namespace(body=doc)
            elif kind == "ResourceQuota":
                # 재배포 시 db_type 변경 반영: 있으면 patch, 없으면 create
                try:
                    core.read_namespaced_resource_quota(name=ns, namespace=ns)
                    core.patch_namespaced_resource_quota(
                        name=ns, namespace=ns, body={"spec": doc["spec"]}
                    )
                    continue  # 외부 except로 떨어지지 않도록
                except ApiException as e:
                    if e.status != 404:
                        raise
                    core.create_namespaced_resource_quota(namespace=ns, body=doc)
            elif kind == "Secret":
                core.create_namespaced_secret(namespace=ns, body=doc)
        except ApiException as e:
            if e.status != 409:
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
def _teardown_one_db(build: Build, db_type: str) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id
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
            _teardown_one_db(build, candidate)


def _apply_redis(build: Build) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id

    if build.use_redis:
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
    else:
        for delete_call in (
            lambda: apps.delete_namespaced_deployment(name="redis", namespace=ns),
            lambda: core.delete_namespaced_service(name="redis", namespace=ns),
        ):
            try:
                delete_call()
            except ApiException as e:
                if e.status != 404:
                    raise


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


# R2 스토리지 토글 — mysql/redis와 같은 철학이되 외부(CF) 리소스라 흐름이 다르다.
# ON  : CF API로 버킷(idempotent) + 새 bucket-scoped 토큰 발급 → r2-secret 생성/교체.
#       재배포마다 토큰을 새로 발급하고 옛 토큰은 revoke (자격증명 회전).
# OFF : r2-secret 삭제 + 토큰 revoke. 버킷(데이터)은 보존 (mysql PVC 보존과 동일 정책).
def _apply_storage(build: Build) -> None:
    if build.user_id is None:
        return
    core = k8s.core_v1()
    ns = build.tenant_id
    old_token_id = _read_r2_token_id(ns)

    if build.use_storage:
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
    else:
        # 토글 off — Secret 제거 + 토큰 revoke. 버킷(데이터)은 보존.
        try:
            core.delete_namespaced_secret(name="r2-secret", namespace=ns)
        except ApiException as e:
            if e.status != 404:
                raise
        if old_token_id:
            r2.deprovision(old_token_id, bucket=None)


def _apply_deployment(build: Build) -> None:
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
    )
    svc = manifests.service(
        app_name=build.app_name,
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        port=build.port,
    )

    # Deployment: strategic merge patch (containers는 name 키로 매칭)
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
    try:
        apps.read_namespaced_deployment(name=build.app_name, namespace=ns)
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

    # HTTPRoute: {app_name}.kodeploy.com → Service (재배포 시 변경 없으므로 create only)
    routes = manifests.httproute(
        app_name=build.app_name,
        tenant_id=build.tenant_id,
        user_id=build.user_id_str,
        port=build.port,
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

