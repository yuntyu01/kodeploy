"""테넌트 ns 프로비저닝 매니페스트 (Namespace + ResourceQuota + ghcr-auth)."""

from app.deploy.manifests._renderer import render_all


# 테넌트 ns 한 묶음 — Namespace, ResourceQuota, Secret(ghcr-auth) 3개 dict 반환.
# 호출 측에서 list 순회하며 K8s API로 apply.
# dockerconfigjson_b64는 호출자가 운영 ghcr-auth Secret을 K8s API로 read해서 전달.
def tenant(
    tenant_id: str,
    user_id: str,
    req_cpu: int,
    lim_cpu: int,
    req_mem: int,
    lim_mem: int,
    dockerconfigjson_b64: str,
) -> list[dict]:
    # compute_quota()는 정확히 이 4개 quota 키만 반환 — 호출 측 **quota splat이
    # 컨트랙트 검사를 받음. 키가 늘거나 이름이 바뀌면 silent no-op이 아니라 TypeError로 터진다.
    return render_all(
        "tenant.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        req_cpu=req_cpu,
        lim_cpu=lim_cpu,
        req_mem=req_mem,
        lim_mem=lim_mem,
        dockerconfigjson_b64=dockerconfigjson_b64,
    )
