"""런타임/의존성 리소스 정의 + 감지 + 합산.

매니페스트 템플릿의 resources는 모두 여기서 주입. 템플릿에는 하드코딩 X.
런타임은 자동 감지하지 않음 — 사용자가 배포 요청 시 명시적으로 선택.
"""

# 컴포넌트별 리소스 단일 진실원 (CPU: m, Memory: Mi)
RUNTIME_RESOURCES: dict[str, dict[str, int]] = {
    "python":   {"req_cpu": 50,  "lim_cpu": 300, "req_mem": 200, "lim_mem": 600},
    "java":     {"req_cpu": 150, "lim_cpu": 500, "req_mem": 700, "lim_mem": 1024},
    "mysql":    {"req_cpu": 50,  "lim_cpu": 200, "req_mem": 300, "lim_mem": 500},
    "postgres": {"req_cpu": 50,  "lim_cpu": 200, "req_mem": 250, "lim_mem": 500},
}

# 사용자가 선택 가능한 런타임 목록 (UI dropdown 등). mysql 같은 의존성은 제외.
# node는 template 미연결 — 추가 시 RUNTIME_RESOURCES + runtimes/node.yaml.j2 + 여기 같이 추가.
SELECTABLE_RUNTIMES = ("python", "java")


def get_resources(component: str) -> dict[str, int]:
    if component not in RUNTIME_RESOURCES:
        raise ValueError(f"unknown component: {component}")
    return RUNTIME_RESOURCES[component]


# 컴포넌트 합산 → tenant ResourceQuota 값 계산
def compute_quota(components: list[str]) -> dict[str, int]:
    total = {"req_cpu": 0, "lim_cpu": 0, "req_mem": 0, "lim_mem": 0}
    for c in components:
        for k, v in get_resources(c).items():
            total[k] += v
    # OS/kernel 오버헤드 + 백엔드 추후 추가 컴포넌트 여유
    total["lim_mem"] += 100
    return total
