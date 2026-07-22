"""배포 오케스트레이션 — 하위 모듈로 분리됨.

router/테스트 호환용 재export facade. 실제 구현:
  build/    — pipeline(제출·빌드·배포), github, naming, validation
  stack/    — resources(테넌트 K8s 리소스)
  routing/  — hostnames(슬롯 규칙·커스텀 도메인)
  status.py — 실시간 상태·빌드 조회·앱 삭제
새 코드는 하위 모듈에서 직접 import할 것. (2단계에서 소비자 import 정리 후 제거 예정.)
"""

from app.deploy.build.github import fetch_recent_commits
from app.deploy.build.naming import (
    RESERVED_NAMES,
    _extract_from_repo,
    _normalize_repo_url,
    _validate_name_format,
)
from app.deploy.build.pipeline import (
    _build_job_name,
    _extract_between,
    get_build_timings,
    spawn_background,
    start_deploy,
    watch_env_change_rollout,
)
from app.deploy.build.validation import (
    _validate_static_env,
    _validate_static_fields,
    _validate_volume_fields,
    reserved_env_keys,
    reserved_env_keys_map,
)
from app.deploy.routing.hostnames import (
    _PSL,
    _extra_hostnames,
    _normalize_domain,
    _slot_hostnames,
    clear_custom_domain,
    refresh_custom_domain_status,
    set_custom_domain,
)
from app.deploy.stack.resources import delete_storage_object, list_storage_objects
from app.deploy.status import delete_app, get_app_status, get_state, list_builds
