# ============================================================================
# security.tf — API 서브도메인 보안 예외
# ----------------------------------------------------------------------------
# Cloudflare 프록시가 cross-origin fetch + credentials 조합을 간헐 차단하는
# 문제 회피. api.kodeploy.com에 대해 브라우저 무결성 검사 비활성화.
# ============================================================================

resource "cloudflare_ruleset" "api_security_skip" {
  zone_id = var.cloudflare_zone_id
  name    = "Skip security for API"
  kind    = "zone"
  phase   = "http_config_settings"

  rules = [
    {
      action      = "set_config"
      expression  = "(http.host eq \"api.${var.domain}\")"
      description = "Disable browser integrity check for API"
      enabled     = true
      action_parameters = {
        bic = false
      }
    }
  ]
}
