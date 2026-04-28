#!/usr/bin/env bash
# retry-apply.sh
#
# OCI Free Tier ARM (Ampere A1) capacity 부족 시 자동 재시도.
# capacity 에러만 재시도하고, 다른 에러는 즉시 종료.
#
# Usage: ./retry-apply.sh [additional terraform apply args]
# Env:   MAX_ATTEMPTS=1000  INTERVAL=60

set -u -o pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

readonly MAX_ATTEMPTS="${MAX_ATTEMPTS:-1000}"
readonly INTERVAL="${INTERVAL:-60}"

CAPACITY_PATTERNS=(
  "Out of host capacity"
  "Out of capacity"
  "InternalError"
  "500-InternalError"
)

timestamp() { date +"%Y-%m-%d %H:%M:%S"; }

is_capacity_error() {
  local output="$1"
  for pattern in "${CAPACITY_PATTERNS[@]}"; do
    if echo "$output" | grep -qi "$pattern"; then
      return 0
    fi
  done
  return 1
}

cleanup() {
  echo ""
  echo "[$(timestamp)] Ctrl+C 감지. 종료합니다."
  exit 130
}
trap cleanup INT

main() {
  if ! command -v terraform &>/dev/null; then
    echo "ERROR: terraform이 PATH에 없습니다."
    exit 127
  fi

  echo "[$(timestamp)] terraform init"
  if ! terraform init -input=false; then
    echo "ERROR: terraform init 실패"
    exit 1
  fi

  local start_ts
  start_ts="$(date +%s)"

  for (( attempt=1; attempt<=MAX_ATTEMPTS; attempt++ )); do
    local now elapsed
    now="$(date +%s)"
    elapsed=$(( now - start_ts ))

    echo ""
    echo "============================================"
    echo "  시도 #${attempt}/${MAX_ATTEMPTS}  |  경과: $((elapsed/60))분 $((elapsed%60))초"
    echo "============================================"

    local output rc
    output="$(terraform apply -auto-approve -input=false "$@" 2>&1)"
    rc=$?

    if (( rc == 0 )); then
      echo "[$(timestamp)] 성공! (시도 #${attempt}, 경과 $((elapsed/60))분)"
      echo "$output" | tail -n 5
      exit 0
    fi

    local last_error
    last_error="$(echo "$output" | grep -i "error" | tail -n 1)"
    echo "[$(timestamp)] 실패 (exit=$rc)"
    echo "  마지막 에러: ${last_error:-알 수 없음}"

    if is_capacity_error "$output"; then
      echo "[$(timestamp)] Capacity 부족. ${INTERVAL}초 후 재시도..."
      sleep "$INTERVAL"
      continue
    fi

    echo "[$(timestamp)] Capacity 외 에러 발생. 즉시 종료."
    echo "$output" | tail -n 20
    exit "$rc"
  done

  echo "[$(timestamp)] 최대 시도 횟수(${MAX_ATTEMPTS}) 초과. 종료."
  exit 124
}

main "$@"
