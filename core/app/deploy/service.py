"""배포 오케스트레이션."""

import asyncio
import re
import time
import uuid

from kubernetes.client.exceptions import ApiException
from sqlalchemy.orm import Session

from app import config
from app.deploy import crud, manifests
from app.deploy.model import Build
from app.shared import k8s
from app.shared.db import SessionLocal


# repo URL 정규화 (BuildKit이 요구하는 .git 접미사 보장)
def _normalize_repo_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url.endswith(".git"):
        url = url + ".git"
    return url


# repo URL 마지막 segment → K8s 리소스명 정규화 (소문자/하이픈, 40자 제한)
def _derive_app_name(repo_url: str) -> str:
    m = re.search(r"/([^/]+?)(?:\.git)?$", repo_url)
    base = m.group(1) if m else "app"
    base = re.sub(r"[^a-z0-9-]", "-", base.lower()).strip("-")
    return (base or "app")[:40]


# build_id로 단건 빌드 상태 조회
def get_state(db: Session, build_id: str) -> Build | None:
    return crud.get_build(db, build_id)


# 전체 빌드 목록 조회
def list_builds(db: Session) -> list[Build]:
    return crud.list_builds(db)


# Build row 생성 + 백그라운드 빌드 태스크 등록
async def start_build(
    db: Session, repo_url: str, branch: str = "main", port: int = 80
) -> Build:
    repo_url = _normalize_repo_url(repo_url)
    build_id = uuid.uuid4().hex[:8]
    app_name = _derive_app_name(repo_url)
    image = f"ghcr.io/{config.GHCR_USER}/{config.GHCR_REPO_PREFIX}-{app_name}:{build_id}"

    build = Build(
        build_id=build_id,
        repo_url=repo_url,
        branch=branch,
        image=image,
        app_name=app_name,
        port=port,
    )
    build = crud.create_build(db, build)

    asyncio.create_task(_run_build(build_id))
    return build


# 백그라운드 빌드 코루틴 (Job 생성 → 폴링 → 성공 시 배포 / 실패 시 로그 저장)
async def _run_build(build_id: str) -> None:
    db = SessionLocal()
    try:
        build = crud.get_build(db, build_id)
        if not build:
            return

        try:
            build.status = "building"
            db.commit()

            job = manifests.buildkit_job(
                build_id=build.build_id,
                image=build.image,
                repo_url=build.repo_url,
                branch=build.branch,
            )
            k8s.batch_v1().create_namespaced_job(namespace=config.K8S_NAMESPACE, body=job)

            success = await _wait_for_job(f"build-{build_id}")
            build.logs = _get_job_logs(build_id)

            if not success:
                build.status = "failed"
                build.error = "빌드 실패"
                db.commit()
                return

            build.status = "deploying"
            db.commit()
            _apply_deployment(build)
            build.status = "deployed"
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
            name=job_name, namespace=config.K8S_NAMESPACE
        )
        if job.status.succeeded:
            return True
        if job.status.failed:
            return False
        await asyncio.sleep(3)
    return False


# build-id 라벨로 BuildKit Pod 찾아 로그 조회
def _get_job_logs(build_id: str) -> str:
    core = k8s.core_v1()
    pods = core.list_namespaced_pod(
        namespace=config.K8S_NAMESPACE,
        label_selector=f"build-id={build_id}",
    )
    if not pods.items:
        return ""
    pod_name = pods.items[0].metadata.name
    try:
        return core.read_namespaced_pod_log(
            name=pod_name, namespace=config.K8S_NAMESPACE
        )
    except ApiException as e:
        return f"로그 조회 실패: {e}"


# Deployment + Service idempotent apply (재배포 시 JSON patch, 없으면 create)
# JSON patch를 쓰는 이유: strategic merge patch는 ports 같은 list를 키 기반으로
# 머지해서 옛 포트가 남거나, Service의 immutable clusterIP를 건드릴 위험이 있음.
def _apply_deployment(build: Build) -> None:
    apps = k8s.apps_v1()
    core = k8s.core_v1()
    ns = config.K8S_NAMESPACE

    deploy = manifests.deployment(
        name=build.app_name, image=build.image, port=build.port
    )
    svc = manifests.service(name=build.app_name, port=build.port)

    # Deployment: image와 ports만 정확히 교체 (list 통째 replace)
    deploy_patch = [
        {
            "op": "replace",
            "path": "/spec/template/spec/containers/0/image",
            "value": build.image,
        },
        {
            "op": "replace",
            "path": "/spec/template/spec/containers/0/ports",
            "value": [{"containerPort": build.port, "protocol": "TCP"}],
        },
    ]
    try:
        apps.read_namespaced_deployment(name=build.app_name, namespace=ns)
        apps.patch_namespaced_deployment(
            name=build.app_name,
            namespace=ns,
            body=deploy_patch,
            _content_type="application/json-patch+json",
        )
    except ApiException as e:
        if e.status != 404:
            raise
        apps.create_namespaced_deployment(namespace=ns, body=deploy)

    # Service: ports만 교체 (clusterIP/selector 등은 건드리지 않음)
    svc_patch = [
        {
            "op": "replace",
            "path": "/spec/ports",
            "value": [
                {
                    "port": build.port,
                    "targetPort": build.port,
                    "protocol": "TCP",
                }
            ],
        }
    ]
    try:
        core.read_namespaced_service(name=build.app_name, namespace=ns)
        core.patch_namespaced_service(
            name=build.app_name,
            namespace=ns,
            body=svc_patch,
            _content_type="application/json-patch+json",
        )
    except ApiException as e:
        if e.status != 404:
            raise
        core.create_namespaced_service(namespace=ns, body=svc)
