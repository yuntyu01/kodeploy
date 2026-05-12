"""환경 변수 기반 설정. 모든 외부 의존(DB/K8s/GHCR/AI)을 한 곳에서 관리."""

import os

# --- DB (MySQL) ---
DB_USER = os.getenv("DB_USER", "kodeploy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "changeme")
DB_HOST = os.getenv("DB_HOST", "mysql")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "kodeploy")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- K8s / GHCR ---
# K8S_NAMESPACE: BuildKit Job·Deployment·Service를 모두 이 네임스페이스에 만든다.
K8S_NAMESPACE = os.getenv("K8S_NAMESPACE", "default")
# GHCR_AUTH_SECRET: dockerconfigjson 타입 Secret 이름. push(BuildKit)와 pull(Deployment) 양쪽에서 사용.
GHCR_AUTH_SECRET = os.getenv("GHCR_AUTH_SECRET", "ghcr-auth")
GHCR_USER = os.getenv("GHCR_USER", "")
GHCR_REPO_PREFIX = os.getenv("GHCR_REPO_PREFIX", "kodeploy")

# --- BuildKit ---
# rootless 이미지: privileged 권한 없이 클러스터 안에서 빌드하기 위함.
BUILDKIT_IMAGE = os.getenv("BUILDKIT_IMAGE", "moby/buildkit:rootless")
BUILD_TIMEOUT_SECONDS = int(os.getenv("BUILD_TIMEOUT_SECONDS", "600"))
