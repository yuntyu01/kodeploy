# ============================================================================
# main.tf — Cloudflare Provider 설정
# ----------------------------------------------------------------------------
# OCI 스택과 별도 state로 운영. NLB IP는 변수로 수동 전달.
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# API 토큰은 환경변수 CLOUDFLARE_API_TOKEN 또는 terraform.tfvars로 주입
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
