# ============================================================================
# redirect.tf — kodeploy.com → app.kodeploy.com 301
# ============================================================================

resource "cloudflare_page_rule" "redirect_apex" {
  zone_id  = var.cloudflare_zone_id
  target   = "${var.domain}/*"
  priority = 1
  status   = "active"

  actions = {
    forwarding_url = {
      url         = "https://app.${var.domain}/$1"
      status_code = 301
    }
  }
}

resource "cloudflare_page_rule" "redirect_www" {
  zone_id  = var.cloudflare_zone_id
  target   = "www.${var.domain}/*"
  priority = 2
  status   = "active"

  actions = {
    forwarding_url = {
      url         = "https://app.${var.domain}/$1"
      status_code = 301
    }
  }
}
