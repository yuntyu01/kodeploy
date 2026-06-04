"""관리자 통계/조회 — 플랫폼 DB 집계 + 노드 리소스.

노드 CPU/메모리/디스크는 VictoriaMetrics를 안 거치고 K8s API proxy의
kubelet stats/summary JSON(/api/v1/nodes/{name}/proxy/stats/summary)을 직접 읽는다 —
라벨 추측 없이 결정적이고, core가 이미 가진 K8s 클라이언트로 끝남.
(RBAC에 nodes + nodes/proxy 읽기 권한 필요 — deploy/k8s/core/rbac.yaml)
"""

import uuid
from datetime import datetime, timedelta, timezone

from kubernetes.client.exceptions import ApiException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.model import User
from app.deploy.model import BuildRecord
from app.shared import k8s


# --- 플랫폼 통계 ---------------------------------------------------------------

def overview(db: Session) -> dict:
    # DB datetime은 naive UTC로 저장됨 — 비교도 naive로.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    user_count = db.query(func.count(User.id)).scalar() or 0
    users_with_app = (
        db.query(func.count(User.id)).filter(User.app_name.isnot(None)).scalar() or 0
    )
    signups_7d = (
        db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0
    )

    builds_total = db.query(func.count(BuildRecord.id)).scalar() or 0
    by_status = dict(
        db.query(BuildRecord.status, func.count(BuildRecord.id))
        .group_by(BuildRecord.status)
        .all()
    )
    builds_24h = (
        db.query(func.count(BuildRecord.id))
        .filter(BuildRecord.started_at >= day_ago)
        .scalar()
        or 0
    )
    # 성공 빌드(최종 running)의 평균 전체 소요시간 — 빌드 체감 속도 지표.
    avg_total = (
        db.query(func.avg(BuildRecord.total_seconds))
        .filter(BuildRecord.status == "running")
        .scalar()
    )

    return {
        "users": {
            "total": user_count,
            "with_app": users_with_app,
            "signups_7d": signups_7d,
        },
        "builds": {
            "total": builds_total,
            "succeeded": by_status.get("running", 0),   # 최종 status "running" = 롤아웃까지 성공
            "failed": by_status.get("failed", 0),
            "cancelled": by_status.get("cancelled", 0),
            "last_24h": builds_24h,
            "avg_success_seconds": round(float(avg_total), 1) if avg_total is not None else None,
        },
    }


# 가입자 목록 + 유저별 빌드 집계 (build_records 기준 — 앱 삭제돼도 카운트 유지).
def list_users(db: Session) -> list[dict]:
    rows = (
        db.query(
            BuildRecord.user_id,
            func.count(BuildRecord.id),
            func.max(BuildRecord.started_at),
        )
        .group_by(BuildRecord.user_id)
        .all()
    )
    build_stats = {uid: (count, last) for uid, count, last in rows}

    users = db.query(User).order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        count, last = build_stats.get(u.id, (0, None))
        out.append({
            "id": str(u.id),
            "login": u.login,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "role": u.role,
            "app_name": u.app_name,
            # tenant ns는 user_id 파생 — 앱 있는 유저만 실제 ns 존재 (lazy provisioning)
            "tenant_id": f"tenant-{u.id.hex[:8]}" if u.app_name else None,
            "custom_domain": u.custom_domain,
            "build_count": count,
            "last_build_at": last.isoformat() if last else None,
            "created_at": u.created_at.isoformat(),
        })
    return out


# 등급 변경 (root 전용 — router가 get_root_user로 보장).
# root 등급은 운영자가 DB에서 직접 지정 — API로는 root 부여/회수 불가.
ASSIGNABLE_ROLES = ("user", "admin")


def set_role(db: Session, target_id: uuid.UUID, role: str, actor: User) -> dict:
    if role not in ASSIGNABLE_ROLES:
        raise ValueError(f"부여 가능한 등급: {', '.join(ASSIGNABLE_ROLES)}")
    target = db.query(User).filter_by(id=target_id).first()
    if not target:
        raise ValueError("유저를 찾을 수 없습니다")
    if target.id == actor.id:
        raise ValueError("자기 자신의 등급은 변경할 수 없습니다")
    if target.role == "root":
        raise ValueError("root 등급은 변경할 수 없습니다")
    target.role = role
    db.commit()
    return {"id": str(target.id), "login": target.login, "role": target.role}


# --- 노드 리소스 ---------------------------------------------------------------

# K8s 리소스 수량 문자열 파서 — cpu("2"/"1500m") → cores, memory("3908020Ki") → bytes.
# 노드 capacity에 실제로 등장하는 단위만 (m / Ki·Mi·Gi). 그 외는 정수 bytes로 간주.
_BYTE_SUFFIX = {"Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4}


def _parse_cpu_cores(v: str) -> float:
    if v.endswith("m"):
        return int(v[:-1]) / 1000
    return float(v)


def _parse_mem_bytes(v: str) -> int:
    for suffix, mul in _BYTE_SUFFIX.items():
        if v.endswith(suffix):
            return int(v[: -len(suffix)]) * mul
    return int(v)


# 노드별 상태 + CPU/메모리/디스크 사용량. master 먼저, 이후 이름순.
# stats/summary 실패(권한/노드 다운)는 그 노드만 error 표시 — 전체 응답은 유지.
def node_stats() -> list[dict]:
    core = k8s.core_v1()
    nodes = core.list_node()
    out = []
    for n in nodes.items:
        name = n.metadata.name
        labels = n.metadata.labels or {}
        capacity = n.status.capacity or {}
        conditions = n.status.conditions or []
        entry = {
            "name": name,
            "role": "master" if "node-role.kubernetes.io/control-plane" in labels else "worker",
            "ready": any(c.type == "Ready" and c.status == "True" for c in conditions),
            "cpu_capacity_cores": _parse_cpu_cores(capacity.get("cpu", "0")),
            "memory_capacity_bytes": _parse_mem_bytes(capacity.get("memory", "0")),
            "cpu_used_cores": None,
            "memory_used_bytes": None,
            "disk_capacity_bytes": None,
            "disk_used_bytes": None,
            "pod_count": None,
        }
        try:
            # kubelet Stats Summary — usageNanoCores/workingSetBytes/fs가 한 JSON에 다 옴
            summary = core.api_client.call_api(
                f"/api/v1/nodes/{name}/proxy/stats/summary",
                "GET",
                auth_settings=["BearerToken"],
                response_type="object",
                _return_http_data_only=True,
            )
            node_sum = summary.get("node", {}) if isinstance(summary, dict) else {}
            cpu = node_sum.get("cpu") or {}
            mem = node_sum.get("memory") or {}
            fs = node_sum.get("fs") or {}
            if cpu.get("usageNanoCores") is not None:
                entry["cpu_used_cores"] = round(cpu["usageNanoCores"] / 1e9, 3)
            if mem.get("workingSetBytes") is not None:
                entry["memory_used_bytes"] = mem["workingSetBytes"]
            entry["disk_capacity_bytes"] = fs.get("capacityBytes")
            entry["disk_used_bytes"] = fs.get("usedBytes")
            pods = summary.get("pods")
            if isinstance(pods, list):
                entry["pod_count"] = len(pods)
        except ApiException as e:
            entry["error"] = f"stats 조회 실패 (HTTP {e.status})"
        out.append(entry)

    out.sort(key=lambda e: (e["role"] != "master", e["name"]))
    return out
