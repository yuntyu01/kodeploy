"""K8s 매니페스트(dict) 빌더 모음.

build.py        = 빌드 단계 (BuildKit Job)
app.py          = 사용자 앱 실행 (Deployment + Service)
tenant.py       = 테넌트 ns 프로비저닝 (Namespace + ResourceQuota + ghcr-auth Secret)
dependencies.py = 의존성 (mysql 등 — Secret + Service + StatefulSet 묶음)
"""

from app.deploy.manifests.app import (
    networkpolicy,
    deployment,
    httproute,
    service,
)
from app.deploy.manifests.build import buildkit_job, nixpacks_buildkit_job
from app.deploy.manifests.dependencies import mysql, postgres, redis
from app.deploy.manifests.tenant import tenant

__all__ = [
    "buildkit_job",
    "networkpolicy",
    "deployment",
    "httproute",
    "mysql",
    "nixpacks_buildkit_job",
    "postgres",
    "redis",
    "service",
    "tenant",
]
