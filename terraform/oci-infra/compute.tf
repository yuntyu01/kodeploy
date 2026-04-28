# ============================================================================
# compute.tf — ARM A1 인스턴스 4대 (for_each)
# ----------------------------------------------------------------------------
# Always Free 한도: 4 OCPU / 24 GB (worker1 + worker2 + managed)
# Master는 유료 풀에서 별도 과금.
# ============================================================================

# 노드 정의 맵 — 각 노드의 호스트명, CPU, 메모리, 역할을 정의
locals {
  nodes = {
    # K8s 컨트롤 플레인 노드 (API Server, etcd, scheduler 등 실행)
    master = {
      hostname  = "kodeploy-master"
      ocpus     = 2
      memory_gb = 4
      role      = "master"
    }
    # K8s 워커 노드 1 — 실제 파드(컨테이너)가 스케줄링되는 노드
    worker1 = {
      hostname  = "kodeploy-worker1"
      ocpus     = 2
      memory_gb = 10
      role      = "worker"
    }
    # K8s 워커 노드 2 — 워커 1과 함께 워크로드를 분산 처리
    worker2 = {
      hostname  = "kodeploy-worker2"
      ocpus     = 1
      memory_gb = 10
      role      = "worker"
    }
    # 관리용 노드 — Ansible/배포 도구 등이 실행되는 관리 전용 노드
    managed = {
      hostname  = "kodeploy-managed"
      ocpus     = 1
      memory_gb = 4
      role      = "managed"
    }
  }
}

# ARM A1 Flex 인스턴스 — for_each로 위 nodes 맵의 4대를 한꺼번에 생성
# VM.Standard.A1.Flex: ARM 기반 가변 스펙 인스턴스 (OCPU/메모리 자유 조합)
resource "oci_core_instance" "node" {
  for_each = local.nodes

  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = each.value.hostname
  shape               = "VM.Standard.A1.Flex"

  # 인스턴스 스펙 설정 — OCPU 수와 메모리를 노드별로 다르게 지정
  shape_config {
    ocpus         = each.value.ocpus
    memory_in_gbs = each.value.memory_gb
  }

  # 부팅 이미지 — Oracle Linux 9 ARM 이미지로 인스턴스 생성
  source_details {
    source_type = "image"
    source_id   = var.image_ocid
  }

  # managed는 퍼블릭 서브넷 + 공인 IP(cloudflared 설치/관리용), 나머지는 프라이빗
  create_vnic_details {
    subnet_id        = each.value.role == "managed" ? oci_core_subnet.public.id : oci_core_subnet.private.id
    assign_public_ip = each.value.role == "managed"
    hostname_label   = each.key
    display_name     = "${each.value.hostname}-vnic"
  }

  # SSH 공개키 주입 — 이 키로만 인스턴스에 SSH 접속 가능
  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
  }

  # 리소스 태그 — 프로젝트명, 역할, 노드 키로 리소스 식별/필터링용
  freeform_tags = {
    project = var.cluster_name
    role    = each.value.role
    node    = each.key
  }

  # 인스턴스 삭제 시 부트 볼륨도 함께 삭제 (Free Tier 볼륨 낭비 방지)
  preserve_boot_volume = false
}
