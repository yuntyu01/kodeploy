"""런타임 로그 스냅샷 — kubectl logs --tail 프록시.

현재 인스턴스 + 이전 인스턴스(크래시 디버깅) 로그를 JSON으로 반환.
프론트에서 수동 새로고침으로 호출.
"""

from kubernetes.client.exceptions import ApiException

from app.shared import k8s

TAIL_LINES = 200


def _pick_pod(pods):
    if not pods:
        return None
    running = [p for p in pods if p.status.phase == "Running"]
    if running:
        return max(running, key=lambda p: (p.status.start_time or p.metadata.creation_timestamp).timestamp())
    return max(pods, key=lambda p: (p.status.start_time or p.metadata.creation_timestamp).timestamp())


def fetch_app_logs(tenant_id: str, app_name: str) -> dict:
    core = k8s.core_v1()

    try:
        pod_list = core.list_namespaced_pod(
            namespace=tenant_id,
            label_selector=f"app={app_name}",
        )
    except ApiException:
        return {"current": [], "previous": [], "error": "로그 조회 실패"}

    pod = _pick_pod(pod_list.items)
    if not pod:
        return {"current": [], "previous": [], "error": "Pod 없음"}

    pod_name = pod.metadata.name

    # 이전 인스턴스 로그 — 컨테이너가 재시작된 적 있을 때만 조회.
    # 재시작 없는 정상 Pod에 previous=True 호출하면 K8s가 400을 던짐.
    previous_lines = []
    has_restart = any(
        (cs.restart_count or 0) > 0
        for cs in (pod.status.container_statuses or [])
    )
    if has_restart:
        try:
            prev = core.read_namespaced_pod_log(
                name=pod_name,
                namespace=tenant_id,
                container="app",
                previous=True,
                tail_lines=TAIL_LINES,
            )
            if prev:
                previous_lines = prev.splitlines()
        except ApiException:
            pass

    # 현재 인스턴스 로그
    current_lines = []
    try:
        current = core.read_namespaced_pod_log(
            name=pod_name,
            namespace=tenant_id,
            container="app",
            tail_lines=TAIL_LINES,
        )
        if current:
            current_lines = current.splitlines()
    except ApiException:
        pass

    return {"current": current_lines, "previous": previous_lines}
