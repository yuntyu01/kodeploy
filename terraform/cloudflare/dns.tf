# ============================================================================
# dns.tf — Cloudflare DNS 레코드
# ----------------------------------------------------------------------------
# - ssh.kodeploy.com  → Cloudflare Tunnel (cfargotunnel.com)
# - api.kodeploy.com  → OCI NLB 공인 IP
# ============================================================================

# SSH 터널 CNAME — 터널 ID가 바뀌면 이 레코드도 자동 갱신
# allow_overwrite: Terraform state 밖에서 수동으로 만들어둔 동일 name+type 레코드가
# 있어도 덮어씀. 초기 import 없이 기존 운영 환경에 적용할 때 필요.
resource "cloudflare_record" "ssh" {
  zone_id         = var.cloudflare_zone_id
  name            = "ssh"
  content         = "${cloudflare_zero_trust_tunnel_cloudflared.kodeploy.id}.cfargotunnel.com"
  type            = "CNAME"
  proxied         = true # Tunnel은 반드시 proxied=true
  ttl             = 1    # proxied=true면 TTL 자동
  allow_overwrite = true
  comment         = "Cloudflare Tunnel (managed by Terraform)"
}

# 와일드카드 — 유저 앱 서브도메인 ({app_name}.kodeploy.com) 전부 NLB로
resource "cloudflare_record" "wildcard" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  content = var.nlb_public_ip
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "User app subdomains (Cloudflare proxy ON)"
}

# API 도메인 A 레코드 — OCI NLB 공인 IP
# proxied=true로 Cloudflare 앞단에 두어 WAF/DDoS/CDN 혜택을 받음.
# Cloudflare SSL/TLS 모드는 Full (strict 아님) — origin은 self-signed 인증서로
# 응답하고 CF가 검증하지 않음. CF↔origin 구간은 OCI 보안 그룹으로 격리.
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = var.nlb_public_ip
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "OCI NLB (Cloudflare proxy ON, Full)"
}
