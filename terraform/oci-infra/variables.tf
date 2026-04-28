# ============================================================================
# variables.tf — 입력 변수
# ----------------------------------------------------------------------------
# 실제 값은 terraform.tfvars 또는 -var / TF_VAR_xxx 로 주입.
# ============================================================================

# ---------- OCI 인증 ---------------------------------------------------------

# OCI 테넌시(최상위 계정) 고유 식별자
variable "tenancy_ocid" {
  description = "OCI 테넌시(계정) OCID"
  type        = string
}

# Terraform API 호출을 실행하는 IAM 사용자 식별자
variable "user_ocid" {
  description = "Terraform API 호출 주체 사용자 OCID"
  type        = string
}

# OCI 콘솔에 등록한 API 공개키의 지문 (aa:bb:cc:... 형식)
variable "fingerprint" {
  description = "OCI 콘솔에 업로드한 API 공개키 fingerprint (aa:bb:cc:... 형식)"
  type        = string
}

# API 공개키와 쌍을 이루는 프라이빗 키 파일 경로 (.pem)
variable "private_key_path" {
  description = "API 공개키와 쌍을 이루는 프라이빗 키 PEM 경로"
  type        = string
}

# 리소스를 생성할 OCI 리전 (예: 춘천, 서울)
variable "region" {
  description = "OCI 리전 (예: ap-chuncheon-1, ap-seoul-1)"
  type        = string
  default     = "ap-chuncheon-1"
}

# 리소스가 소속될 구획(Compartment) — OCI의 리소스 그룹 단위
variable "compartment_ocid" {
  description = "리소스를 생성할 구획(Compartment) OCID"
  type        = string
}

# ---------- 이미지 / 키 / AD -------------------------------------------------

# VM에 설치할 OS 이미지 OCID (Oracle Linux 9 ARM, 리전마다 다름)
variable "image_ocid" {
  description = "Oracle Linux 9 ARM 이미지 OCID (리전별로 다름)"
  type        = string
}

# 인스턴스에 SSH 접속할 때 사용할 공개키 파일 경로
variable "ssh_public_key_path" {
  description = "인스턴스 SSH 접속용 공개키 경로"
  type        = string
  default     = "~/.ssh/kodeploy_oci.pub"
}

# 인스턴스를 배치할 가용 도메인 (데이터센터 내 물리적 격리 단위)
variable "availability_domain" {
  description = "가용 도메인 이름 (OCI 콘솔에서 확인)"
  type        = string
}

# ---------- 네이밍 / 네트워크 -------------------------------------------------

# 모든 리소스 이름 앞에 붙는 접두사 겸 태그
variable "cluster_name" {
  description = "리소스 이름 접두사 겸 태그"
  type        = string
  default     = "kodeploy"
}

# VCN 전체 IP 대역 (10.0.0.0/16 = 65,536개 IP)
variable "vcn_cidr" {
  description = "VCN CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

# NLB가 위치하는 퍼블릭 서브넷 대역
variable "public_subnet_cidr" {
  description = "Public 서브넷 CIDR (NLB 전용)"
  type        = string
  default     = "10.0.1.0/24"
}

# 모든 노드(master/worker/managed)가 위치하는 프라이빗 서브넷 대역
variable "private_subnet_cidr" {
  description = "Private 서브넷 CIDR (모든 노드)"
  type        = string
  default     = "10.0.2.0/24"
}
