"""Cloudflare for SaaS 커스텀 호스트네임 프로비저닝 — 유저가 자기 도메인을 앱에 연결.

r2.py와 같은 철학: 외부(Cloudflare) 리소스라 K8s가 아니라 CF REST API를 호출하는
함수 모듈. ABC/Protocol/인터페이스 없음 — 케이스 하나다. service.py가 호출해 custom
hostname을 만들고/지우고, 검증·cert 상태를 폴링한다.

흐름:
- create : POST /custom_hostnames (ssl method=http DV) → CF가 엣지 cert 발급 준비.
           유저는 자기 도메인 DNS에 CNAME → CUSTOM_DOMAIN_CNAME_TARGET(fallback origin) 추가.
           CNAME이 CF를 가리키면 HTTP DCV가 자동 통과 → status active.
- status : 이름으로 조회 → status(pending/active) + ssl.status.
- delete : 이름으로 찾아 DELETE /custom_hostnames/{id}. (앱 삭제 시 정리, best-effort)

⚠️ custom hostname은 **zone 단위** API (CF_ZONE_ID). R2(account 단위)와 다른 스코프라
   _client() base_url이 /zones/{id} 다 (r2.py는 /accounts/{id}).

오리진 도달 후의 origin-lock(이 도메인 트래픽이 CF 경유인지 검증)은 X-Origin-Verify
헤더 + HTTPRoute 헤더 매칭이 담당(별도) — 이 모듈은 CF 측 custom hostname 수명주기만.
"""

import httpx

from app import config

_API_BASE = "https://api.cloudflare.com/client/v4"


class DomainError(Exception):
    """사용자에게 그대로 노출 가능한 커스텀 도메인 프로비저닝 실패."""


# 설정이 갖춰졌는지 (기능 활성 가능 여부). router/service에서 사전 차단용.
def is_configured() -> bool:
    return bool(config.CF_ZONE_API_TOKEN and config.CF_ZONE_ID)


def _require_configured() -> None:
    if not is_configured():
        raise DomainError(
            "커스텀 도메인이 서버에 설정되지 않았습니다 (CF_ZONE_API_TOKEN / CF_ZONE_ID 미설정)"
        )


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=f"{_API_BASE}/zones/{config.CF_ZONE_ID}",
        headers={
            "Authorization": f"Bearer {config.CF_ZONE_API_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )


# CF API 응답 봉투 검사 — success=false면 errors를 사람이 읽을 메시지로 (r2._unwrap과 동일).
# list 엔드포인트(custom_hostnames?hostname=)도 result가 배열이라 그대로 반환(호출부가 isinstance 체크).
def _unwrap(resp: httpx.Response):
    try:
        body = resp.json()
    except ValueError:
        raise DomainError(f"CF API 응답 파싱 실패 (status={resp.status_code})")
    if not body.get("success", False):
        errs = body.get("errors") or [{"message": resp.text}]
        msg = "; ".join(e.get("message", str(e)) for e in errs)
        raise DomainError(f"CF API 오류: {msg}")
    return body.get("result") or {}


# CF custom hostname result → 우리가 쓰는 평평한 dict.
def _summarize(result: dict) -> dict:
    ssl = result.get("ssl") or {}
    return {
        "id": result.get("id"),
        "hostname": result.get("hostname"),
        "status": result.get("status"),       # pending | active | ...
        "ssl_status": ssl.get("status"),       # initializing | pending_validation | active | ...
    }


# --- 고수준 API (service.py / router가 호출) ---

# 커스텀 호스트네임 생성. 서브도메인 전용 — http DCV(CNAME이 origin→CF를 가리키면 자동 검증).
# (apex는 CNAME 위임이 불가해 미지원. service에서 사전 차단.)
# 멱등: 이미 존재하면(중복) 기존 것을 채택해 반환 — 재시도/orphan(직전 생성 후 후속 단계 실패) 안전.
def create(hostname: str) -> dict:
    _require_configured()
    with _client() as client:
        resp = client.post(
            "/custom_hostnames",
            json={"hostname": hostname, "ssl": {"method": "http", "type": "dv"}},
        )
    try:
        return _summarize(_unwrap(resp))
    except DomainError as e:
        if "duplicate" in str(e).lower():
            existing = find(hostname)
            if existing:
                return existing
        raise


# 이름으로 custom hostname 조회 (없으면 None). status/delete가 CF id를 얻는 데 사용 —
# User엔 도메인만 저장하고 id는 저장 안 하므로(컬럼 2개 정책) 매번 이름으로 lookup.
def find(hostname: str) -> dict | None:
    _require_configured()
    with _client() as client:
        results = _unwrap(client.get("/custom_hostnames", params={"hostname": hostname}))
    if isinstance(results, list) and results:
        return _summarize(results[0])
    return None


# 검증/cert 상태 조회 — UI 폴링용. 없으면 None.
def get_status(hostname: str) -> dict | None:
    return find(hostname)


# 커스텀 호스트네임 삭제 (best-effort) — 앱/도메인 삭제 시. 정리 실패가 흐름을 막지 않게.
def delete(hostname: str) -> None:
    if not is_configured():
        return
    existing = find(hostname)
    if not existing or not existing.get("id"):
        return
    with _client() as client:
        resp = client.delete(f"/custom_hostnames/{existing['id']}")
    if resp.status_code in (200, 404):
        return
    # 그 외 실패는 조용히 (정리 실패가 앱 삭제 흐름을 막지 않게 — r2._delete_token과 동일 철학)
