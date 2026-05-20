"""빌드 단계용 K8s 매니페스트 (templates/build*.yaml.j2 렌더)."""

from app import config
from app.deploy.manifests._renderer import render


# rootless BuildKit 일회성 Job (git → GHCR push)
# dockerfile_subdir: repo root 기준 Dockerfile이 있는 디렉토리 (없으면 root). BuildKit context로 사용됨.
# dockerfile_filename: Dockerfile 파일 이름 (default "Dockerfile", "Dockerfile.multi" 등 가능).
def buildkit_job(
    build_id: str,
    user_id: str,
    image: str,
    repo_url: str,
    branch: str,
    dockerfile_subdir: str = "",
    dockerfile_filename: str = "Dockerfile",
) -> dict:
    return render(
        "buildkit_job.yaml.j2",
        build_id=build_id,
        user_id=user_id,
        image=image,
        repo_url=repo_url,
        branch=branch,
        dockerfile_subdir=dockerfile_subdir,
        dockerfile_filename=dockerfile_filename,
        buildkit_image=config.BUILDKIT_IMAGE,
        ghcr_auth_secret=config.GHCR_AUTH_SECRET_NAME,
    )
