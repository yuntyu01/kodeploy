# ============================================================================
# outputs.tf — 출력 값
# ----------------------------------------------------------------------------
# tunnel_token은 ansible playbook이 받아서 managed 노드 cloudflared 설치에 사용.
# 수동 조회: `terraform output -raw tunnel_token`
# ============================================================================

# cloudflared service install 시 사용하는 토큰
# secret 값을 포함하므로 sensitive
output "tunnel_token" {
  description = "cloudflared --token 인자에 사용할 토큰"
  value       = cloudflare_zero_trust_tunnel_cloudflared.kodeploy.tunnel_token
  sensitive   = true
}
