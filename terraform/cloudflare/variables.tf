# ============================================================================
# variables.tf — 입력 변수
# ----------------------------------------------------------------------------
# 실제 값은 terraform.tfvars 또는 TF_VAR_xxx 환경변수로 주입.
# ============================================================================

# ---------- Cloudflare 인증 --------------------------------------------------

# Cloudflare API Token — terraform이 "사용"하는 부트스트랩 자격증명. terraform으로 만들지 않는다
# (자기가 쓸 토큰을 자기가 만들 수 없음 = 닭-달걀). 대시보드에서 수동 발급/편집해 주입.
# 필요한 권한 (대상 zone: kodeploy.com):
#   - Account → Cloudflare Tunnel: Edit
#   - Zone → DNS: Edit
#   - Zone → SSL and Certificates: Edit   # Authenticated Origin Pulls(origin_tls_client_auth) — origin-mtls.tf
#   - Zone → Config Rules: Edit           # http_config_settings ruleset — security.tf (UI 그룹명 다르면 Rulesets/WAF 계열 매칭)
# 발급: dash.cloudflare.com → My Profile → API Tokens → 기존 토큰 Edit 또는 Create Token
variable "cloudflare_api_token" {
  description = "Cloudflare API Token (Tunnel + DNS + SSL/Certificates + Config Rules)"
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
