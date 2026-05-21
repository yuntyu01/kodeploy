"""배포 오케스트레이션."""

import asyncio
import os.path
import re
import time
import urllib.error
import urllib.request
import uuid

from kubernetes.client.exceptions import ApiException
from sqlalchemy.orm import Session

from app import config
from app.deploy import crud, manifests, runtimes
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


def _resolve_app_name(
    name: str | None,
    repo_url: str,
    user_id: uuid.UUID | None,
    db: Session,
) -> str:
    if name:
        _validate_name_format(name)
        return name

    derived = _extract_from_repo(repo_url)
    if derived:
        return derived

    return f"app-{uuid.uuid4().hex[:8]}"


# build_id로 단건 빌드 상태 조회
def get_state(db: Session, build_id: str) -> Build | None:
    return crud.get_build(db, build_id)


# 전체 빌드 목록 조회
def list_builds(db: Session) -> list[Build]:
    return crud.list_builds(db)


# Build row 생성 + 백그라운드 빌드 태스크 등록
async def start_build(
    db: Session,
    repo_url: str,
    runtime: str,
    name: str | None = None,
    branch: str = "main",
    port: int = 80,
    user_id: uuid.UUID | None = None,
    use_db: bool = False,
    build_mode: str = "dockerfile",
    dockerfile_path: str = "Dockerfile",
    project_path: str = "",
) -> Build:
    repo_url = _normalize_repo_url(repo_url)
    build_id = uuid.uuid4().hex[:8]
    if user_id is None:
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    app_name = _resolve_app_name(name, repo_url, user_id, db)
    user_hex = user_id.hex[:8] if user_id else "anonymous"
    image = f"ghcr.io/{config.GHCR_USER}/{user_hex}/{app_name}:{build_id}"

    build = Build(
        build_id=build_id,
        repo_url=repo_url,
        branch=branch,
        image=image,
        app_name=app_name,
        port=port,
        runtime=runtime,
        user_id=user_id,
        use_db=use_db,
        build_mode=build_mode,
        dockerfile_path=dockerfile_path,
        project_path=project_path.strip("/"),  # 앞뒤 슬래시 정리 — manifest에서 ${PROJECT_PATH:+/$PROJECT_PATH}로 결합
    )
    build = crud.create_build(db, build)

    asyncio.create_task(_run_build(build_id))
    return build


# BuildKit Job 이름 (template과 동일 규칙 — _wait_for_job/로그 조회 시 사용)
def _build_job_name(build_id: str, user_id_str: str) -> str:
    return f"build-{user_id_str[:8]}-{build_id}"


# 백그라운드 빌드 코루틴 (Job 생성 → 폴링 → 성공 시 배포 / 실패 시 로그 저장)
async def _run_build(build_id: str) -> None:
    db = SessionLocal()
    try:
        build = crud.get_build(db, build_id)
        if not build:
            return

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

            if not success:
                build.status = "failed"
                build.error = "빌드 실패"
                db.commit()
                return

            build.status = "built" # 빌드 과정 완료
            db.commit()

            # 추후 이미지 스캔 등 추가 가능

            build.status = "deploying" # 클러스터 배포 시작
            db.commit()
            _ensure_tenant_ns(build)

            # mysql 토글 — PVC/Secret은 보존 (데이터·비번 유지)
            if build.use_db:
                _ensure_mysql(build)
            else:
                _teardown_mysql(build)

            _apply_deployment(build)

            ready = await _wait_for_rollout(build.app_name, build.tenant_id)
            if ready:
                build.status = "running"
            else:
                build.status = "failed"
                build.error = "Pod 시작 실패 (타임아웃)"
            db.commit()

        except Exception as e:
            build.status = "failed"
            build.error = f"오케스트레이션 에러: {e}"
            db.commit()
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


# java startupProbe(failureThreshold 30 × period 10s = 5분)와 동일 상한.
# multi-stage Dockerfile + java -jar 패턴은 보통 1분 안에 부팅, 5분이면 충분 여유.
ROLLOUT_TIMEOUT_SECONDS = 300


async def _wait_for_rollout(app_name: str, namespace: str) -> bool:
    deadline = time.time() + ROLLOUT_TIMEOUT_SECONDS
    apps = k8s.apps_v1()
    while time.time() < deadline:
        dep = apps.read_namespaced_deployment_status(
            name=app_name, namespace=namespace
        )
        ready = dep.status.ready_replicas or 0
        desired = dep.spec.replicas or 1
        if ready >= desired:
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
# 이유: use_db 토글에 따라 mysql 컴포넌트가 quota에 합산되거나 빠질 수 있어 재배포 시 갱신 필요.
def _ensure_tenant_ns(build: Build) -> None:
    if build.user_id is None:
        return

    core = k8s.core_v1()
    ns = build.tenant_id

    secret = core.read_namespaced_secret(
        name=config.GHCR_AUTH_SECRET_NAME,
        namespace=config.BUILD_NAMESPACE,
    )
    dockerconfigjson_b64 = secret.data[".dockerconfigjson"]

    # use_db True면 mysql 자원도 quota에 합산 — 재배포 시마다 현재 상태 반영
    components = [build.runtime] + (["mysql"] if build.use_db else [])
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
                # 재배포 시 use_db 변경 반영: 있으면 patch, 없으면 create
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


# use_db=True: 같은 ns에 mysql Secret/Service/StatefulSet 프로비저닝 (모두 409 skip).
# 재배포 시 다시 호출돼도 안전 — 첫 호출의 비번이 영구 유지되고,
# 옛 PVC가 남아있으면 새 StatefulSet이 자동 재바인딩해서 데이터 자연 복원.
def _ensure_mysql(build: Build) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id

    docs = manifests.mysql(tenant_id=ns, user_id=build.user_id_str)
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


# use_db=False: StatefulSet + Service만 삭제. PVC/Secret은 의도적으로 보존.
# 다시 use_db=True로 켜면 새 StatefulSet이 옛 PVC + 옛 Secret에 자동 바인딩 → 복원.
# 데이터 진짜 삭제는 별도 명시 액션으로 분리 (현재 미구현).
def _teardown_mysql(build: Build) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = build.tenant_id

    for delete_call in (
        lambda: apps.delete_namespaced_stateful_set(name="mysql", namespace=ns),
        lambda: core.delete_namespaced_service(name="mysql", namespace=ns),
    ):
        try:
            delete_call()
        except ApiException as e:
            if e.status != 404:
                raise


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
