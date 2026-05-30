"""런타임/의존성 리소스 정의 + 감지 + 합산.

매니페스트 템플릿의 resources는 모두 여기서 주입. 템플릿에는 하드코딩 X.
런타임은 자동 감지하지 않음 — 사용자가 배포 요청 시 명시적으로 선택.
"""

# 컴포넌트별 리소스 단일 진실원 (CPU: m, Memory/Storage: Mi)
# req_eph/lim_eph = 컨테이너 ephemeral-storage(노드 로컬 임시 디스크) 상한.
#   유저 런타임(python/java)에만 둠 — 유저 코드가 노드 디스크를 무한 점유하면
#   초과 시 그 Pod만 evict되고 노드/다른 테넌트는 보호됨. 의존성(mysql 등)은 데이터가
#   PVC라 ephemeral 폭주 위험이 낮아 제외 (tenant quota에 ephemeral을 넣으면 모든 Pod이
#   ephemeral 선언을 강제당해 admission 거부되므로, 컨테이너 limit만으로 방어).
RUNTIME_RESOURCES: dict[str, dict[str, int]] = {
    "python":   {"req_cpu": 50,  "lim_cpu": 300, "req_mem": 200, "lim_mem": 600,  "req_eph": 100, "lim_eph": 1024},
    "java":     {"req_cpu": 150, "lim_cpu": 500, "req_mem": 700, "lim_mem": 1024, "req_eph": 100, "lim_eph": 1024},
    "mysql":    {"req_cpu": 50,  "lim_cpu": 200, "req_mem": 300, "lim_mem": 500},
    "postgres": {"req_cpu": 50,  "lim_cpu": 200, "req_mem": 250, "lim_mem": 500},
    "redis":    {"req_cpu": 25,  "lim_cpu": 100, "req_mem": 64,  "lim_mem": 192},
}

# 사용자가 선택 가능한 런타임 목록 (UI dropdown 등). mysql 같은 의존성은 제외.
# node는 template 미연결 — 추가 시 RUNTIME_RESOURCES + runtimes/node.yaml.j2 + 여기 같이 추가.
SELECTABLE_RUNTIMES = ("python", "java")


def get_resources(component: str) -> dict[str, int]:
    if component not in RUNTIME_RESOURCES:
        raise ValueError(f"unknown component: {component}")
    return RUNTIME_RESOURCES[component]


# tenant ResourceQuota(ns 총량 상한)에 들어가는 키 — cpu/mem만.
# ephemeral-storage는 quota에 넣지 않는다(넣으면 ns의 모든 Pod이 eph 선언을 강제당해
# admission 거부됨). eph 방어는 런타임 컨테이너 spec의 resources.limits.ephemeral-storage로
# 한다(runtimes/*.yaml.j2). 따라서 합산 대상도 quota 키로 한정 — 새 키가 늘어도 quota엔
# 의도한 것만 들어가고, tenant()에 누락되면 KeyError로 시끄럽게 터진다(silent no-op 방지).
_QUOTA_KEYS = ("req_cpu", "lim_cpu", "req_mem", "lim_mem")


# 컴포넌트 합산 → tenant ResourceQuota 값 계산. quota 키만 합산(eph 등은 제외).
def compute_quota(components: list[str]) -> dict[str, int]:
    total: dict[str, int] = {k: 0 for k in _QUOTA_KEYS}
    for c in components:
        res = get_resources(c)
        for k in _QUOTA_KEYS:
            total[k] += res.get(k, 0)
    total["lim_mem"] += 100
    return total
