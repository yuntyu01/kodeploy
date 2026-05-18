# ============================================================================
# lb.tf — OCI Network Load Balancer (L4, Always Free)
# ----------------------------------------------------------------------------
# Public Subnet에 NLB를 배치하고, Private Subnet의 워커 노드로 트래픽 전달.
# 구조: 인터넷 → NLB(퍼블릭) → 워커 노드(프라이빗)
# ============================================================================

# 워커 노드 키만 필터링 (NLB 백엔드에 워커만 등록하기 위함)
locals {
  worker_keys = [for k, v in local.nodes : k if v.role == "worker"]
}

# ---------------------------------------------------------------------------
# Network Load Balancer — L4(TCP) 로드밸런서, 퍼블릭 서브넷에 배치
# 외부 트래픽을 받아 프라이빗 서브넷의 워커 노드로 분배
# ---------------------------------------------------------------------------
resource "oci_network_load_balancer_network_load_balancer" "kodeploy" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.cluster_name}-nlb"
  subnet_id      = oci_core_subnet.public.id
  is_private     = false # 공인 IP를 가지는 퍼블릭 NLB

  freeform_tags = { project = var.cluster_name }
}

# ---------------------------------------------------------------------------
# HTTP 백엔드 셋 — 포트 80 트래픽을 워커 노드들에 분배하는 그룹
# FIVE_TUPLE 정책: 출발지IP/포트 + 목적지IP/포트 + 프로토콜 기반 분배
# ---------------------------------------------------------------------------
resource "oci_network_load_balancer_backend_set" "http" {
  name                     = "http-backend-set"
  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  policy                   = "FIVE_TUPLE"
  # SNAT 활성화 — 워커가 NLB로 응답하도록 함 (비대칭 라우팅 회피)
  # 클라이언트 IP는 Gateway 컨트롤러의 X-Forwarded-For 헤더로 확인
  is_preserve_source = false

  # TCP 헬스체크 — Envoy proxy Service의 NodePort 30080이 열려있는지 확인
  health_checker {
    protocol = "TCP"
    port     = 30080
  }
}

# HTTP 백엔드 — 각 워커 노드의 NodePort 30080으로 트래픽 전달
# envoy proxy Service(envoy-gateway-system ns)가 NodePort 30080에 노출되어 있어,
# 어느 워커로 가도 kube-proxy가 envoy proxy Pod으로 forward.
resource "oci_network_load_balancer_backend" "http" {
  for_each = toset(local.worker_keys)

  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  backend_set_name         = oci_network_load_balancer_backend_set.http.name
  port                     = 30080
  target_id                = oci_core_instance.node[each.key].id
  name                     = "${each.key}-http"
}

# HTTP 리스너 — NLB 포트 80으로 들어오는 TCP 트래픽을 HTTP 백엔드 셋으로 전달
resource "oci_network_load_balancer_listener" "http" {
  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  name                     = "http-listener"
  default_backend_set_name = oci_network_load_balancer_backend_set.http.name
  port                     = 80
  protocol                 = "TCP"
}

# ---------------------------------------------------------------------------
# HTTPS 백엔드 셋 — 포트 443 트래픽을 워커 노드들에 분배하는 그룹
# (NLB는 L4이므로 TLS 종료는 노드/Ingress Controller가 담당)
# ---------------------------------------------------------------------------
resource "oci_network_load_balancer_backend_set" "https" {
  name                     = "https-backend-set"
  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  policy                   = "FIVE_TUPLE"
  # SNAT 활성화 — HTTP 백엔드 셋과 동일 사유 (비대칭 라우팅 회피)
  is_preserve_source = false

  # TCP 헬스체크 — Envoy proxy Service의 NodePort 30443이 열려있는지 확인
  health_checker {
    protocol = "TCP"
    port     = 30443
  }
}

# HTTPS 백엔드 — 각 워커 노드의 NodePort 30443으로 트래픽 전달
resource "oci_network_load_balancer_backend" "https" {
  for_each = toset(local.worker_keys)

  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  backend_set_name         = oci_network_load_balancer_backend_set.https.name
  port                     = 30443
  target_id                = oci_core_instance.node[each.key].id
  name                     = "${each.key}-https"
}

# HTTPS 리스너 — NLB 포트 443으로 들어오는 TCP 트래픽을 HTTPS 백엔드 셋으로 전달
resource "oci_network_load_balancer_listener" "https" {
  network_load_balancer_id = oci_network_load_balancer_network_load_balancer.kodeploy.id
  name                     = "https-listener"
  default_backend_set_name = oci_network_load_balancer_backend_set.https.name
  port                     = 443
  protocol                 = "TCP"
}
