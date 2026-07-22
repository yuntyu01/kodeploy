"""_apply_deployment의 patch-vs-replace 판단 + Service 포트 치유 고정.

실제 사고가 났던 자리의 안전망:
- 런타임/포트/마운트 드리프트면 image-only patch가 아니라 통째 replace여야 한다
  (patch는 probe·volume·port를 제거 못 해 기동 불능/좀비 마운트가 된다).
- Service는 read-modify-replace — strategic merge였다면 포트 변경 시 옛 포트가
  안 지워져 "이름 없는 2-port"가 됐다 (커밋 8ddfed5).
K8s는 전부 mock — manifest 렌더는 실제 템플릿을 탄다.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

from kubernetes.client.exceptions import ApiException

from app.deploy.model import Build
from app.deploy.stack import resources


def make_build(runtime="python", port=8000, volume_mount_path=""):
    return Build(
        build_id="abc12345",
        repo_url="https://github.com/u/repo.git",
        branch="main",
        image="ghcr.io/u/x/foo:abc12345",
        app_name="foo",
        port=port,
        runtime=runtime,
        user_id=uuid.uuid4(),
        volume_mount_path=volume_mount_path,
        volume_storage_class="local-path",
        volume_size="5Gi",
    )


def fake_existing_deployment(runtime="python", port=8000, mount=None):
    """read_namespaced_deployment 반환 모양 — 판단에 쓰이는 필드만."""
    volume_mounts = (
        [SimpleNamespace(name="data", mount_path=mount)] if mount else []
    )
    container = SimpleNamespace(
        ports=[SimpleNamespace(container_port=port)],
        volume_mounts=volume_mounts,
    )
    return SimpleNamespace(
        metadata=SimpleNamespace(labels={"runtime": runtime}, resource_version="42"),
        spec=SimpleNamespace(
            template=SimpleNamespace(spec=SimpleNamespace(containers=[container]))
        ),
    )


def fake_existing_service(ports):
    return SimpleNamespace(spec=SimpleNamespace(ports=ports))


def patch_k8s(monkeypatch, apps, core, custom=None):
    monkeypatch.setattr(resources.k8s, "apps_v1", lambda: apps)
    monkeypatch.setattr(resources.k8s, "core_v1", lambda: core)
    monkeypatch.setattr(resources.k8s, "custom", lambda: custom or MagicMock())


def apply(monkeypatch, build, existing_dep, existing_svc=None):
    apps, core = MagicMock(), MagicMock()
    if isinstance(existing_dep, Exception):
        apps.read_namespaced_deployment.side_effect = existing_dep
    else:
        apps.read_namespaced_deployment.return_value = existing_dep
    if existing_svc is None:
        core.read_namespaced_service.side_effect = ApiException(status=404)
    elif isinstance(existing_svc, Exception):
        core.read_namespaced_service.side_effect = existing_svc
    else:
        core.read_namespaced_service.return_value = existing_svc
    patch_k8s(monkeypatch, apps, core)
    resources._apply_deployment(build, hostnames=["foo.kodeploy.com"])
    return apps, core


# --- Deployment: patch vs replace vs create ---

def test_same_runtime_port_mount_patches_image_only(monkeypatch):
    apps, _ = apply(monkeypatch, make_build(), fake_existing_deployment())

    assert apps.patch_namespaced_deployment.called
    assert not apps.replace_namespaced_deployment.called
    assert not apps.create_namespaced_deployment.called
    body = apps.patch_namespaced_deployment.call_args.kwargs["body"]
    container = body["spec"]["template"]["spec"]["containers"][0]
    assert container["image"] == "ghcr.io/u/x/foo:abc12345"


def test_runtime_change_replaces_whole_deployment(monkeypatch):
    # java probe/리소스가 남은 채 python 이미지만 갈면 기동 불능 — 통째 replace
    apps, _ = apply(
        monkeypatch, make_build(runtime="python"),
        fake_existing_deployment(runtime="java", port=8000),
    )

    assert apps.replace_namespaced_deployment.called
    assert not apps.patch_namespaced_deployment.called
    body = apps.replace_namespaced_deployment.call_args.kwargs["body"]
    # replace(PUT)는 optimistic concurrency용 resourceVersion 필수
    assert body["metadata"]["resourceVersion"] == "42"


def test_port_change_replaces_whole_deployment(monkeypatch):
    apps, _ = apply(
        monkeypatch, make_build(port=3000),
        fake_existing_deployment(port=8080),
    )
    assert apps.replace_namespaced_deployment.called
    assert not apps.patch_namespaced_deployment.called


def test_volume_mount_drift_replaces_whole_deployment(monkeypatch):
    # 마운트 토글/경로 변경은 patch로 반영 불가 (volume 제거를 못 함) — replace
    apps, _ = apply(
        monkeypatch, make_build(volume_mount_path="/data"),
        fake_existing_deployment(mount=None),
    )
    assert apps.replace_namespaced_deployment.called
    assert not apps.patch_namespaced_deployment.called


def test_missing_deployment_creates(monkeypatch):
    apps, _ = apply(monkeypatch, make_build(), ApiException(status=404))
    assert apps.create_namespaced_deployment.called
    assert not apps.patch_namespaced_deployment.called
    assert not apps.replace_namespaced_deployment.called


# --- Service: 단일 포트 read-modify-replace ---

def test_service_ports_replaced_to_single_named_port(monkeypatch):
    # 과거 2-port 버그로 오염된 Service도 다음 배포 때 단일 포트로 치유돼야 한다
    stale = fake_existing_service(ports=[
        SimpleNamespace(port=8080), SimpleNamespace(port=3000),
    ])
    _, core = apply(
        monkeypatch, make_build(port=3000), fake_existing_deployment(port=3000),
        existing_svc=stale,
    )

    assert core.replace_namespaced_service.called
    body = core.replace_namespaced_service.call_args.kwargs["body"]
    assert len(body.spec.ports) == 1
    only = body.spec.ports[0]
    assert (only.name, only.port, only.target_port) == ("http", 3000, 3000)


def test_missing_service_creates(monkeypatch):
    _, core = apply(monkeypatch, make_build(), fake_existing_deployment())
    assert core.create_namespaced_service.called
    assert not core.replace_namespaced_service.called
