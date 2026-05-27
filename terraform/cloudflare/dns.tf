# ============================================================================
# dns.tf — Cloudflare DNS 레코드
# ============================================================================

# v4 → v5 state 마이그레이션
moved {
  from = cloudflare_record.ssh
  to   = cloudflare_dns_record.ssh
}

moved {
  from = cloudflare_record.wildcard
  to   = cloudflare_dns_record.wildcard
}

moved {
  from = cloudflare_record.api
  to   = cloudflare_dns_record.api
}

# SSH 터널 CNAME
resource "cloudflare_dns_record" "ssh" {
  zone_id = var.cloudflare_zone_id
  name    = "ssh"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.kodeploy.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
  ttl     = 1
  comment = "Cloudflare Tunnel (managed by Terraform)"
}

# 와일드카드 — 유저 앱 서브도메인 전부 NLB로
resource "cloudflare_dns_record" "wildcard" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  content = var.nlb_public_ip
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "User app subdomains (Cloudflare proxy ON)"
}

# Apex — 리다이렉트 전용 (redirect.tf에서 301 → app.kodeploy.com)
resource "cloudflare_dns_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = "192.0.2.1"
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "Redirect placeholder (→ app.kodeploy.com)"
}

# www — 리다이렉트 전용 (redirect.tf에서 301 → app.kodeploy.com)
resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = "192.0.2.1"
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "Redirect placeholder (→ app.kodeploy.com)"
}

# API 도메인 A 레코드
resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = var.nlb_public_ip
  type    = "A"
  proxied = true
  ttl     = 1
  comment = "OCI NLB (CF proxy ON, API security via Configuration Rule)"
}
