# ============================================================================
# main.tf — Provider 설정
# ============================================================================

terraform {
  required_version = ">= 0.14.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

# OCI 프로바이더 — Terraform이 OCI API를 호출할 때 사용하는 인증 정보
# tenancy/user OCID, API 키 fingerprint, 프라이빗 키 경로, 리전을 지정
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# OCI 내부 서비스 목록 조회 — Service Gateway가 라우팅할 OCI 내부 서비스(yum repo 등) 목록을 가져옴
data "oci_core_services" "all" {
  filter {
    name   = "name"
    values = ["All .* Services In Oracle Services Network"]
    regex  = true
  }
}
