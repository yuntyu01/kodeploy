"""빌드 단계용 K8s 매니페스트 (templates/build*.yaml.j2 렌더)."""

from app import config
from app.deploy.manifests._renderer import render


# rootless BuildKit 일회성 Job (git → GHCR push)
def buildkit_job(build_id: str, image: str, repo_url: str, branch: str) -> dict:
    return render(
        "buildkit_job.yaml.j2",
        build_id=build_id,
        image=image,
        repo_url=repo_url,
        branch=branch,
        namespace=config.K8S_NAMESPACE,
        buildkit_image=config.BUILDKIT_IMAGE,
        ghcr_auth_secret=config.GHCR_AUTH_SECRET_NAME,
    )
