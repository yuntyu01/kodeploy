"""환경 변수 기반 설정. 모든 외부 의존(DB/K8s/GHCR)을 한 곳에서 관리.

분류:
- 시크릿 / 환경별 다른 값 / 운영 튜닝 → env (ConfigMap·Secret으로 주입)
- 시스템 고정값 (ns 이름, 이미지 등) → 코드 상수
"""

import os

# --- DB (MySQL) — env 필수 (시크릿 + 환경별) ---
DB_USER = os.getenv("DB_USER", "kodeploy")
DB_PASSWORD = os.getenv("DB_PASSWORD", "changeme")
DB_HOST = os.getenv("DB_HOST", "mysql")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "kodeploy")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- K8s / GHCR ---
# 시스템 고정 ns 이름들 — env로 받을 가치 0 (시크릿/환경별/운영 튜닝 아무것도 아님)
BUILD_NAMESPACE = "kodeploy-build"                  # 모든 유저의 BuildKit Job이 들어가는 ns. user-id 라벨로 격리
DEFAULT_TENANT_NS = "default"                       # 인증 미연결(user_id=None) 빌드의 fallback ns (Phase 2에서 사라질 변수)
GHCR_AUTH_SECRET_NAME = "ghcr-auth"                 # dockerconfigjson Secret 이름 (push/pull 양쪽에서 참조)

# GHCR 운영 계정 — 환경별 다를 수 있어 env
GHCR_USER = os.getenv("GHCR_USER", "")


# --- BuildKit ---
BUILDKIT_IMAGE = "moby/buildkit:rootless"           # rootless: privileged 권한 없이 빌드 가능. 거의 안 바뀌는 시스템 도구
BUILD_TIMEOUT_SECONDS = int(os.getenv("BUILD_TIMEOUT_SECONDS", "600"))  # 운영 튜닝 가능

# --- CORS ---
# 쉼표로 구분된 허용 origin 목록. 환경별 다름 (dev=localhost, 운영=Cloudflare Pages 도메인).
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]
