"""빌드 단계용 K8s 매니페스트 (templates/build*.yaml.j2 렌더)."""

from app import config
from app.deploy.manifests._renderer import render


# rootless BuildKit 일회성 Job (git → GHCR push) — dockerfile 모드 전용
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


# 자동 빌드 모드 Job — init container(nixpacks) + main(BuildKit), emptyDir 공유.
# project_path: repo root 기준 서브디렉토리 (빈 값=root). 사용자가 명시 — 자동 탐색 없음 (Heroku/Railway 등과 동일 컨벤션).
# build_args: nixpacks가 만든 Dockerfile에 박힌 ARG들 (백엔드가 plan.json에서 파싱해 전달).
def nixpacks_buildkit_job(
    build_id: str,
    user_id: str,
    image: str,
    repo_url: str,
    branch: str,
    project_path: str = "",
    build_args: dict[str, str] | None = None,
) -> dict:
    return render(
        "nixpacks_buildkit_job.yaml.j2",
        build_id=build_id,
        user_id=user_id,
        image=image,
        repo_url=repo_url,
        branch=branch,
        project_path=project_path,
        build_args=build_args or {},
        buildkit_image=config.BUILDKIT_IMAGE,
        ghcr_auth_secret=config.GHCR_AUTH_SECRET_NAME,
    )
