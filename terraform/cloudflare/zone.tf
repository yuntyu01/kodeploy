# ============================================================================
# zone.tf — Cloudflare Zone-level SSL/TLS 정책
# ============================================================================

resource "cloudflare_zone_settings_override" "kodeploy" {
  zone_id = var.cloudflare_zone_id

  settings {
    # Full: 사용자↔CF, CF↔origin 모두 HTTPS. CF가 origin 인증서 검증은 안 함.
    # origin은 Gateway 컨트롤러에 박은 self-signed 인증서로 응답.
    # 외부 인증기관 의존 없이 전 구간 암호화.
    ssl = "full"

    # HTTP로 들어와도 HTTPS로 자동 리다이렉트
    always_use_https = "on"

    # TLS 최소 버전 — 1.2 미만 차단
    min_tls_version = "1.2"

    # Brotli 압축 (CDN 응답 크기 절감)
    brotli = "on"
  }
}
