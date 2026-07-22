"""테넌트 ns 프로비저닝 매니페스트 (Namespace + ghcr-auth Secret)."""

from app.deploy.stack.manifests._renderer import render_all


# 테넌트 ns 한 묶음 — Namespace, Secret(ghcr-auth) 2개 dict 반환.
# 호출 측에서 list 순회하며 K8s API로 apply.
# dockerconfigjson_b64는 호출자가 운영 ghcr-auth Secret을 K8s API로 read해서 전달.
# (ResourceQuota는 제거됨 — Pod limit은 런타임 템플릿이 직접 박고, ns 상한은
#  컴포넌트 구성이 고정이라 구조적으로 결정됨. runtimes.py 주석 참고.)
def tenant(
    tenant_id: str,
    user_id: str,
    dockerconfigjson_b64: str,
) -> list[dict]:
    return render_all(
        "tenant.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        dockerconfigjson_b64=dockerconfigjson_b64,
    )
