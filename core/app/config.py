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
# GHCR_AUTH_SECRET_NAME: dockerconfigjson 타입 Secret의 "이름". push(BuildKit)와 pull(Deployment) 양쪽에서 참조.
GHCR_AUTH_SECRET_NAME = os.getenv("GHCR_AUTH_SECRET_NAME", "ghcr-auth")
GHCR_USER = os.getenv("GHCR_USER", "")
GHCR_REPO_PREFIX = os.getenv("GHCR_REPO_PREFIX", "kodeploy")

# --- BuildKit ---
# rootless 이미지: privileged 권한 없이 클러스터 안에서 빌드하기 위함.
BUILDKIT_IMAGE = os.getenv("BUILDKIT_IMAGE", "moby/buildkit:rootless")
BUILD_TIMEOUT_SECONDS = int(os.getenv("BUILD_TIMEOUT_SECONDS", "600"))

# --- CORS ---
# 쉼표로 구분된 허용 origin 목록. 개발은 localhost, 운영은 Cloudflare Pages 도메인.
# "*"로 두면 전부 허용 (개발 편의용, 운영에서는 명시).
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]
