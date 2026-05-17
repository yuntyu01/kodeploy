# ============================================================================
# variables.tf — 입력 변수
# ----------------------------------------------------------------------------
# 실제 값은 terraform.tfvars 또는 TF_VAR_xxx 환경변수로 주입.
# ============================================================================

# ---------- Cloudflare 인증 --------------------------------------------------

# Cloudflare API Token
# 필요한 권한:
#   - Account → Cloudflare Tunnel: Edit
#   - Zone → DNS: Edit (대상 zone: kodeploy.com)
# 발급: dash.cloudflare.com → My Profile → API Tokens → Create Token
variable "cloudflare_api_token" {
  description = "Cloudflare API Token (Tunnel + DNS 권한)"
  type        = string
  sensitive   = true
}

# Cloudflare Account ID — 대시보드 우측 사이드바에서 확인
variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

# Zone ID — 도메인 Overview 페이지 우측 사이드바에서 확인
variable "cloudflare_zone_id" {
  description = "kodeploy.com Zone ID"
  type        = string
}

# ---------- 도메인 ------------------------------------------------------------

# 관리할 apex 도메인
variable "domain" {
  description = "관리할 apex 도메인"
  type        = string
  default     = "kodeploy.com"
}

# ---------- OCI 연결 정보 ----------------------------------------------------

# OCI NLB 공인 IP — api.kodeploy.com A 레코드로 등록
# `cd ../oci-infra && terraform output nlb_public_ip` 결과를 그대로 사용
variable "nlb_public_ip" {
  description = "OCI NLB 공인 IP"
  type        = string
}
