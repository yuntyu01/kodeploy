# ============================================================================
# origin-mtls.tf — 오리진 잠금 레이어 B의 Cloudflare 쪽 (Authenticated Origin Pulls)
# ----------------------------------------------------------------------------
# 자체 CA로 발급한 origin-pull client cert(68-origin-mtls.yml 산출물)를 CF에 업로드하고,
# 호스트별로 AOP를 켜서 CF가 오리진(Envoy)에 그 cert를 제시하게 한다.
# Envoy ClientTrafficPolicy(deploy/k8s/gateway/origin-mtls.yaml)가 이 cert를 우리 CA로
# 검증 → 우리 CF zone을 거친 트래픽만 origin 도달. (CF 공유 cert 아님 = 자체 cert가 핵심)
#
# 선행: ansible/playbooks/68-origin-mtls.yml (.tls-selfsigned/origin-pull.{crt,key} 생성)
#
# ⚠️ private_key가 terraform state에 저장됨(민감). 이 디렉토리 .gitignore가 terraform.tfstate를
#    제외하므로 커밋되진 않음(로컬 state 한정).
# ⚠️ 무중단 순서: 이 리소스 apply는 안전(CF가 cert 제시 시작해도, optional:true인 Envoy는 통과).
#    위험한 건 Envoy를 optional:false로 "먼저" 강제하는 것뿐. 반드시 apply 후 → Envoy 강제.
# ============================================================================

# per-hostname AOP용 자체 client cert 업로드 → cert_id 산출
resource "cloudflare_authenticated_origin_pulls_hostname_certificate" "origin_pull" {
  zone_id     = var.cloudflare_zone_id
  certificate = file("${path.module}/../../.tls-selfsigned/origin-pull.crt")
  private_key = file("${path.module}/../../.tls-selfsigned/origin-pull.key")
}

# 호스트별 AOP 활성 — 위 자체 cert로.
# ⚠️ v5 provider는 리소스당 hostname 정확히 1개만 허용("config must contain exactly one hostname
#    association") → for_each로 호스트마다 리소스 1개씩 생성.
locals {
  # AOP를 켤 호스트 목록. 와일드카드 `*.${var.domain}`이 per-hostname AOP에 먹히는지는 미검증 —
  # 먹히면 이 목록에 한 줄 추가하면 끝, 안 되면 앱 생성(HTTPRoute) 흐름=레이어2 DomainProvider에서
  # 호스트별 등록으로 전환.
  origin_lock_hostnames = [
    "api.${var.domain}",
    "dailo.${var.domain}",
  ]
}

resource "cloudflare_authenticated_origin_pulls" "origin_lock" {
  for_each = toset(local.origin_lock_hostnames)

  zone_id = var.cloudflare_zone_id
  config = [
    {
      hostname = each.value
      cert_id  = cloudflare_authenticated_origin_pulls_hostname_certificate.origin_pull.id
      enabled  = true
    },
  ]
}
