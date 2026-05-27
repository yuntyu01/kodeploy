# ============================================================================
# pages.tf — Cloudflare Workers (static assets) 커스텀 도메인
# ----------------------------------------------------------------------------
# Workers 프로젝트(kodeploy)는 GitHub Actions + wrangler deploy로 관리.
# 커스텀 도메인은 이 리소스가 DNS 레코드도 자동 생성/관리.
# ============================================================================

resource "cloudflare_workers_custom_domain" "app" {
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = "app.${var.domain}"
  service    = "kodeploy"
}
