"""사용자 앱 실행용 K8s 매니페스트 (templates/{deployment,service}.yaml.j2 렌더)."""

from app import config
from app.deploy.manifests._renderer import render


# 사용자 앱 Deployment
def deployment(name: str, image: str, port: int, replicas: int = 1) -> dict:
    return render(
        "deployment.yaml.j2",
        name=name,
        image=image,
        port=port,
        replicas=replicas,
        namespace=config.K8S_NAMESPACE,
        ghcr_auth_secret=config.GHCR_AUTH_SECRET_NAME,
    )


# 앱 앞단 ClusterIP Service
def service(name: str, port: int) -> dict:
    return render(
        "service.yaml.j2",
        name=name,
        port=port,
        namespace=config.K8S_NAMESPACE,
    )
