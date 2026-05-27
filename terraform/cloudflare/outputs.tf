# ============================================================================
# outputs.tf — 출력 값
# ----------------------------------------------------------------------------
# tunnel_token은 ansible playbook이 받아서 managed 노드 cloudflared 설치에 사용.
# 수동 조회: `terraform output -raw tunnel_token`
# ============================================================================

# cloudflared service install 시 사용하는 토큰
# secret 값을 포함하므로 sensitive
output "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  value       = cloudflare_zero_trust_tunnel_cloudflared.kodeploy.id
}
