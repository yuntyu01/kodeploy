"""K8s 매니페스트(dict) 빌더 모음.

build.py = 빌드 단계 (BuildKit Job)
app.py   = 사용자 앱 실행 (Deployment + Service)
"""

from app.deploy.manifests.app import deployment, service
from app.deploy.manifests.build import buildkit_job

__all__ = ["buildkit_job", "deployment", "service"]
