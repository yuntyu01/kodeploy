# ============================================================================
# pages.tf — Cloudflare Pages 참조 문서
# ----------------------------------------------------------------------------
# Pages 프로젝트는 대시보드에서 관리 (v5 provider가 통합 Workers/Pages
# 프로젝트 import를 지원하지 않아 Terraform 관리 불가).
#
# 대시보드 설정:
#   - 프로젝트: kodeploy (kodeploy.yuntyu01.workers.dev)
#   - GitHub: yuntyu01/kodeploy (main push 시 자동 빌드+배포)
#   - 빌드: root=web, cmd="npm run build"
#   - 배포: npx wrangler deploy (wrangler.jsonc로 assets=web/dist)
#   - 환경변수: VITE_API_BASE=https://api.kodeploy.com
#
# DNS/리다이렉트는 Terraform 관리:
#   - dns.tf:      app.kodeploy.com CNAME → kodeploy.yuntyu01.workers.dev
#   - dns.tf:      kodeploy.com A → 192.0.2.1 (redirect placeholder)
#   - redirect.tf: kodeploy.com → app.kodeploy.com 301
# ============================================================================
