# ============================================================================
# tunnel.tf — Cloudflare Tunnel (remotely-managed)
# ----------------------------------------------------------------------------
# remotely-managed 방식: ingress 라우팅 규칙을 Cloudflare 측에서 보관/관리.
# managed 노드의 cloudflared는 토큰 하나만 들고 실행되며 config.yml 불필요.
# ============================================================================

# Tunnel secret — credentials 인증용 랜덤 값
# byte_length 35 = base64 인코딩 시 48자 (Cloudflare 권장값)
resource "random_id" "tunnel_secret" {
  byte_length = 35
}

# Cloudflare Tunnel 리소스 — managed 노드의 cloudflared가 이 터널로 연결
resource "cloudflare_zero_trust_tunnel_cloudflared" "kodeploy" {
  account_id = var.cloudflare_account_id
  name       = "kodeploy"
  secret     = random_id.tunnel_secret.b64_std

  # ingress 라우팅 규칙을 Cloudflare 측에서 관리 (remotely-managed).
  # 노드는 토큰만 들고 연결되고 config.yml/credentials.json 불필요.
  # "local"로 두면 노드의 /etc/cloudflared/config.yml로 규칙을 관리하는 옛 방식.
  config_src = "cloudflare"
}

# 터널의 ingress 라우팅 규칙
# 호스트네임 → 내부 서비스 매핑. 새 호스트 추가 시 이 블록만 늘리면 끝.
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "kodeploy" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.kodeploy.id

  config {
    # 1. SSH 접근: ssh.kodeploy.com → managed 노드의 22번 포트
    ingress_rule {
      hostname = "ssh.${var.domain}"
      service  = "ssh://localhost:22"
    }

    # 2. catch-all (필수): 위 규칙에 매칭 안 되는 요청은 404 반환
    ingress_rule {
      service = "http_status:404"
    }
  }
}
