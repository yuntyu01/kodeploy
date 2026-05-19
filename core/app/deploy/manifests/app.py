"""사용자 앱 실행용 K8s 매니페스트 (templates/runtimes/{runtime}.yaml.j2 렌더)."""

from app import config
from app.deploy.manifests._renderer import render, render_all
from app.deploy.runtimes import get_resources


# 런타임 → template 매핑. SELECTABLE_RUNTIMES와 sync 유지.
_RUNTIME_TEMPLATES = {
    "python": "runtimes/python.yaml.j2",
    "java": "runtimes/java.yaml.j2",
}


# 사용자 앱 Deployment (런타임별 템플릿 + RUNTIME_RESOURCES 자동 주입)
def deployment(
    runtime: str,
    app_name: str,
    tenant_id: str,
    user_id: str,
    image: str,
    port: int,
    replicas: int = 1,
) -> dict:
    template_name = _RUNTIME_TEMPLATES[runtime]          # 미지원 runtime → KeyError (스키마가 막아주니까)
    res = get_resources(runtime)
    return render(
        template_name,
        app_name=app_name,
        tenant_id=tenant_id,
        user_id=user_id,
        image=image,
        port=port,
        replicas=replicas,
        ghcr_auth_secret=config.GHCR_AUTH_SECRET_NAME,
        **res,                                           # req_cpu/lim_cpu/req_mem/lim_mem
    )


# 앱 앞단 ClusterIP Service (런타임과 무관 — 동일 template)
def service(app_name: str, tenant_id: str, user_id: str, port: int) -> dict:
    return render(
        "service.yaml.j2",
        app_name=app_name,
        tenant_id=tenant_id,
        user_id=user_id,
        port=port,
    )


# 앱 서브도메인 라우팅 (HTTPS + HTTP→HTTPS redirect)
def httproute(app_name: str, tenant_id: str, user_id: str, port: int) -> list[dict]:
    return render_all(
        "httproute.yaml.j2",
        app_name=app_name,
        tenant_id=tenant_id,
        user_id=user_id,
        port=port,
    )
