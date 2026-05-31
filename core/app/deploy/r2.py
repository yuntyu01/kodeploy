"""Cloudflare R2 오브젝트 스토리지 프로비저닝 (레벨 2: 앱당 버킷 + bucket-scoped 토큰).

mysql/redis는 K8s 워크로드라 매니페스트로 띄우지만, R2는 **외부(Cloudflare) 리소스**다.
그래서 이 모듈은 K8s가 아니라 Cloudflare REST API를 호출한다. 산출물은 딱 하나 —
S3 호환 자격증명을 담은 dict. service.py가 그걸 `r2-secret` K8s Secret으로 만들어
앱 Pod에 envFrom으로 주입한다 (mysql-secret과 동일한 흡수 방식).

레벨 2 격리 모델:
- 앱마다 버킷 1개 (`kd-{app_name}`). R2 버킷 한도 100만 → 앱당 버킷은 사실상 무한.
- 버킷마다 **그 버킷에만 스코프된 API 토큰** 발급 → 테넌트 간 객체 접근 차단.
- 토큰의 id가 곧 S3 Access Key ID, 토큰 value의 SHA-256(hex)이 Secret Access Key
  (Cloudflare의 공식 파생 규칙).

⚠️ 이 모듈의 Cloudflare API 호출(엔드포인트/권한그룹/토큰→S3키 파생)은 실제 토큰으로
   한 번 검증이 필요하다. 계정/토큰이 비어 있으면 storage 토글은 ValueError로 막힌다.

참고 문서:
- 버킷 CRUD: POST/DELETE /accounts/{acct}/r2/buckets
- managed dev 도메인: PUT /accounts/{acct}/r2/buckets/{bucket}/domains/managed
- 계정 토큰: POST/DELETE /accounts/{acct}/tokens (R2 권한그룹 + 버킷 리소스 스코프)
"""

import hashlib

import httpx

from app import config

_API_BASE = "https://api.cloudflare.com/client/v4"


class R2Error(Exception):
    """사용자에게 그대로 노출 가능한 R2 프로비저닝 실패."""


# 설정이 갖춰졌는지 (토글 활성 가능 여부). router/service에서 사전 차단용.
def is_configured() -> bool:
    return bool(config.CF_API_TOKEN and config.CF_ACCOUNT_ID)


def _require_configured() -> None:
    if not is_configured():
        raise R2Error(
            "R2가 설정되지 않았습니다 (CF_API_TOKEN / CF_ACCOUNT_ID 미설정)"
        )


# app_name → R2 버킷 이름. "kd-" 접두사로 (1) 최소 길이(R2는 3자 이상) 보장,
# (2) KoDeploy가 만든 버킷임을 식별 (orphan 정리/검색 용이).
def bucket_name(app_name: str) -> str:
    return f"kd-{app_name}"


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=f"{_API_BASE}/accounts/{config.CF_ACCOUNT_ID}",
        headers={
            "Authorization": f"Bearer {config.CF_API_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )


# CF API 응답 봉투 검사 — success=false면 errors를 사람이 읽을 메시지로.
def _unwrap(resp: httpx.Response) -> dict:
    try:
        body = resp.json()
    except ValueError:
        raise R2Error(f"CF API 응답 파싱 실패 (status={resp.status_code})")
    if not body.get("success", False):
        errs = body.get("errors") or [{"message": resp.text}]
        msg = "; ".join(e.get("message", str(e)) for e in errs)
        raise R2Error(f"CF API 오류: {msg}")
    return body.get("result") or {}


# --- 버킷 ---

# 버킷 생성 (idempotent — 이미 있으면 통과). 같은 앱 재배포 시 데이터 보존.
def _create_bucket(client: httpx.Client, bucket: str) -> None:
    resp = client.post("/r2/buckets", json={"name": bucket})
    if resp.status_code == 409:
        return  # 이미 존재 — mysql StatefulSet 409 skip과 동일 철학
    _unwrap(resp)


# 버킷 삭제 (best-effort). R2는 빈 버킷만 삭제 가능 — 객체가 남아 있으면 실패한다.
# v1에서는 토큰 revoke로 접근 자체를 끊는 게 1차 격리이고, 비어 있으면 버킷도 정리.
# 비어있지 않아 실패하면 swallow (orphan 버킷은 백로그의 sweeper가 처리).
def _delete_bucket(client: httpx.Client, bucket: str) -> None:
    resp = client.delete(f"/r2/buckets/{bucket}")
    if resp.status_code in (200, 404):
        return
    # 비어있지 않음(409 등) — 데이터 보존 우선, 조용히 둠.


# managed dev 도메인(pub-*.r2.dev) 활성화 → 공개 URL 반환. 실패하면 None.
# 운영용 커스텀 도메인(cdn.kodeploy.com 등)은 백로그 — v1 비공개 테스트엔 r2.dev로 충분.
def _enable_public_url(client: httpx.Client, bucket: str) -> str | None:
    try:
        resp = client.put(
            f"/r2/buckets/{bucket}/domains/managed",
            json={"enabled": True},
        )
        result = _unwrap(resp)
    except R2Error:
        return None
    domain = result.get("domain")
    if not domain:
        return None
    return domain if domain.startswith("http") else f"https://{domain}"


# --- 스코프 토큰 ---

# R2 읽기+쓰기 권한그룹 id 목록. 운영에서 env로 명시(CF_R2_PERMISSION_GROUP_IDS)했으면
# 그걸 쓰고, 아니면 /tokens/permission_groups에서 이름으로 자동 탐색.
def _r2_permission_group_ids(client: httpx.Client) -> list[str]:
    if config.CF_R2_PERMISSION_GROUP_IDS:
        return list(config.CF_R2_PERMISSION_GROUP_IDS)
    resp = client.get("/tokens/permission_groups")
    groups = _unwrap(resp)
    if not isinstance(groups, list):
        raise R2Error("권한그룹 목록 형식이 예상과 다릅니다")
    # 이름에 "R2"가 들어가고 읽기/쓰기인 그룹만. (object read/write)
    wanted = []
    for g in groups:
        name = (g.get("name") or "")
        if "R2" in name and ("Write" in name or "Read" in name):
            wanted.append(g["id"])
    if not wanted:
        raise R2Error(
            "R2 권한그룹을 찾지 못했습니다 (CF_R2_PERMISSION_GROUP_IDS로 명시 필요)"
        )
    return wanted


# 버킷 1개에만 스코프된 계정 토큰 발급 → (token_id, secret_access_key) 반환.
# CF 규칙: token_id = S3 Access Key ID, secret = SHA-256(token_value) hex.
def _create_scoped_token(
    client: httpx.Client, bucket: str, pg_ids: list[str]
) -> tuple[str, str]:
    # 버킷 리소스 스코프 키 — jurisdiction 기본값 "default".
    resource_key = (
        f"com.cloudflare.edge.r2.bucket."
        f"{config.CF_ACCOUNT_ID}_default_{bucket}"
    )
    body = {
        "name": f"kodeploy-r2-{bucket}",
        "policies": [
            {
                "effect": "allow",
                "permission_groups": [{"id": pid} for pid in pg_ids],
                "resources": {resource_key: "*"},
            }
        ],
    }
    resp = client.post("/tokens", json=body)
    result = _unwrap(resp)
    token_id = result.get("id")
    token_value = result.get("value")
    if not token_id or not token_value:
        raise R2Error("토큰 발급 응답에 id/value가 없습니다")
    secret_access_key = hashlib.sha256(token_value.encode()).hexdigest()
    return token_id, secret_access_key


def _delete_token(client: httpx.Client, token_id: str) -> None:
    resp = client.delete(f"/tokens/{token_id}")
    if resp.status_code in (200, 404):
        return
    # 그 외 실패는 조용히 — 정리 실패가 앱 삭제 흐름을 막지 않게.


# --- 고수준 API (service.py가 호출) ---

# 앱용 R2 버킷 + 스코프 토큰 프로비저닝. 앱 Pod에 주입할 S3 호환 env dict 반환.
# 재배포마다 호출돼도 안전: 버킷은 idempotent, 토큰은 새로 발급(옛 토큰은 _apply_storage가
# 교체 전 정리). 키 이름은 generic S3_* + AWS_* 별칭 둘 다 — AWS SDK(Dailo)·boto3·기타
# OSS가 추가 설정 없이 자격증명을 읽도록.
def provision(app_name: str) -> tuple[dict[str, str], str]:
    _require_configured()
    bucket = bucket_name(app_name)
    with _client() as client:
        _create_bucket(client, bucket)
        public_url = _enable_public_url(client, bucket) or ""
        pg_ids = _r2_permission_group_ids(client)
        token_id, secret_key = _create_scoped_token(client, bucket, pg_ids)

    env = {
        # generic (KoDeploy 표준 규약)
        "S3_ENDPOINT": config.R2_S3_ENDPOINT,
        "S3_REGION": "auto",                 # R2는 region "auto"
        "S3_ACCESS_KEY": token_id,
        "S3_SECRET_KEY": secret_key,
        "S3_BUCKET": bucket,
        "S3_PUBLIC_BASE_URL": public_url,
        # AWS SDK / boto3 표준 env 별칭 — 코드 수정 없이 자격증명 자동 인식
        "AWS_ACCESS_KEY_ID": token_id,
        "AWS_SECRET_ACCESS_KEY": secret_key,
        "AWS_DEFAULT_REGION": "auto",
        "AWS_REGION": "auto",
        "AWS_ENDPOINT_URL_S3": config.R2_S3_ENDPOINT,
        "AWS_ENDPOINT_URL": config.R2_S3_ENDPOINT,
    }
    return env, token_id


# 토큰 revoke (+ 빈 버킷이면 삭제). 토글 off / 앱 삭제 시 호출.
# bucket=None이면 버킷은 보존하고 토큰만 정리 (토글 off의 "데이터 보존" 정책).
def deprovision(token_id: str | None, bucket: str | None = None) -> None:
    if not is_configured():
        return
    with _client() as client:
        if token_id:
            _delete_token(client, token_id)
        if bucket:
            _delete_bucket(client, bucket)
