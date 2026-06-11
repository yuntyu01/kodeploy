"""입력 검증 벨트 고정 — 정적 빌드 필드 · 볼륨 필드 · 환경변수 · 스냅샷 토큰.

전부 순수 함수라 클러스터 없이 검증 가능. 형식이 조용히 풀리면
"정체불명 빌드 실패"(친절벨트)나 path traversal(_staged_path)로 이어지는 지점들이다.
"""

import pytest

from app.deploy import env as env_module
from app.deploy import service as svc
from app.deploy import snapshots
from app.deploy.snapshots import SnapshotError


# --- _validate_static_env — 빌드 타임 변수 (번들 공개값) ---

def test_static_env_strips_keys():
    assert svc._validate_static_env({" VITE_X ": "1"}) == {"VITE_X": "1"}


def test_static_env_allows_shell_specials_in_value():
    # 이스케이프는 manifests(_dockerfile_env_value) 몫 — 검증은 줄바꿈/길이만 본다
    out = svc._validate_static_env({"VITE_X": 'a$b"c\\d'})
    assert out["VITE_X"] == 'a$b"c\\d'


def test_static_env_too_many_keys():
    with pytest.raises(ValueError):
        svc._validate_static_env({f"K{i}": "v" for i in range(21)})


@pytest.mark.parametrize("key", ["vite_x", "1A", "A-B"])
def test_static_env_bad_key(key):
    with pytest.raises(ValueError):
        svc._validate_static_env({key: "v"})


def test_static_env_value_too_long():
    with pytest.raises(ValueError):
        svc._validate_static_env({"K": "a" * 1001})


def test_static_env_newline_rejected():
    with pytest.raises(ValueError):
        svc._validate_static_env({"K": "a\nb"})


# --- _validate_static_fields — 빌드 커맨드/출력 디렉토리 ---

def test_static_fields_empty_passthrough():
    assert svc._validate_static_fields("", "") == ("", "")


def test_static_fields_default_output_dir_dist():
    assert svc._validate_static_fields("npm ci && npm run build", "") == (
        "npm ci && npm run build", "dist",
    )


def test_static_fields_output_dir_slash_trim():
    assert svc._validate_static_fields("x", "/dist/") == ("x", "dist")


def test_static_fields_newline_in_cmd():
    with pytest.raises(ValueError):
        svc._validate_static_fields("a\nb", "")


def test_static_fields_cmd_too_long():
    with pytest.raises(ValueError):
        svc._validate_static_fields("a" * 301, "")


@pytest.mark.parametrize("outdir", ["../etc", "out put"])
def test_static_fields_bad_output_dir(outdir):
    # build_cmd 유무와 무관하게 output_dir 형식은 검증된다
    with pytest.raises(ValueError):
        svc._validate_static_fields("", outdir)


# --- _validate_volume_fields — 영속저장소 local(PVC) ---

def test_volume_fields_normalizes_trailing_slash_and_defaults():
    mp, sc, sz = svc._validate_volume_fields("/var/www/html/data/", "", "")
    assert (mp, sc, sz) == ("/var/www/html/data", "local-path", "5Gi")


@pytest.mark.parametrize("mp", ["data", "/a/../b", "/a b", "/"])
def test_volume_mount_path_rejected(mp):
    with pytest.raises(ValueError):
        svc._validate_volume_fields(mp, "local-path", "5Gi")


def test_volume_storage_class_rejected():
    with pytest.raises(ValueError):
        svc._validate_volume_fields("/d", "Bad_Class", "5Gi")


@pytest.mark.parametrize("size", ["0Gi", "5G", "Gi", "5gi"])
def test_volume_size_rejected(size):
    with pytest.raises(ValueError):
        svc._validate_volume_fields("/d", "local-path", size)


@pytest.mark.parametrize("size", ["512Mi", "5Gi", "1Ti"])
def test_volume_size_ok(size):
    assert svc._validate_volume_fields("/d", "local-path", size)[2] == size


# --- env.validate_env — 서버 런타임 환경변수 ({app}-env Secret) ---

def test_env_valid_passes():
    env_module.validate_env({"DB_URL": "x", "_PRIVATE": "y", "A1": "a" * 4096})


def test_env_too_many_keys():
    with pytest.raises(ValueError):
        env_module.validate_env({f"K{i}": "v" for i in range(51)})


@pytest.mark.parametrize("key", ["PYTHONUNBUFFERED", "JAVA_TOOL_OPTIONS"])
def test_env_reserved_keys(key):
    # 플랫폼이 env:로 박는 키 — envFrom보다 우선이라 어차피 무시되지만 혼란 방지로 명시 거절
    with pytest.raises(ValueError):
        env_module.validate_env({key: "v"})


def test_env_bad_key_and_value():
    with pytest.raises(ValueError):
        env_module.validate_env({"lower": "v"})
    with pytest.raises(ValueError):
        env_module.validate_env({"K": 1})  # 문자열 아님
    with pytest.raises(ValueError):
        env_module.validate_env({"K": "a" * 4097})


# --- snapshots._staged_path — 초기 덤프 토큰 (path traversal 차단) ---

def test_staged_path_valid_token():
    token = "a" * 32
    path = snapshots._staged_path(token)
    assert path.startswith(snapshots._STAGE_DIR)
    assert path.endswith(f"{token}.dump")


@pytest.mark.parametrize("token", [
    "",                       # 빈 값
    "A" * 32,                 # 대문자 hex 아님
    "a" * 31,                 # 길이 미달
    "../../etc/passwd",       # traversal
])
def test_staged_path_rejects_bad_tokens(token):
    with pytest.raises(SnapshotError):
        snapshots._staged_path(token)
