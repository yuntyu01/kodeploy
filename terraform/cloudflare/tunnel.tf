# ============================================================================
# tunnel.tf — Cloudflare Tunnel (remotely-managed)
# ----------------------------------------------------------------------------
# v5 마이그레이션 중 — tunnel secret/config 스키마가 바뀌어서
# ignore_changes = all로 잠금. Terraform이 기존 터널을 건드리지 않음.
# 터널 설정 변경은 Cloudflare 대시보드에서 직접.
# ============================================================================

resource "cloudflare_zero_trust_tunnel_cloudflared" "kodeploy" {
  account_id = var.cloudflare_account_id
  name       = "kodeploy"
  config_src = "cloudflare"

  lifecycle {
    ignore_changes = all
  }
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "kodeploy" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.kodeploy.id

  config = {
    ingress_rule = [
      {
        hostname = "ssh.${var.domain}"
        service  = "ssh://localhost:22"
      },
      {
        service = "http_status:404"
      }
    ]
  }

  lifecycle {
    ignore_changes = all
  }
}
