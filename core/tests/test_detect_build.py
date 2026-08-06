"""build_mode=detect의 빌드 대상 선택 규칙 고정 — _choose_build_target 순수 함수.

우선순위: Dockerfile > 선택 런타임의 nixpacks 마커 > 그 외 마커, 각각 root 가까운 것.
풀스택 repo(백엔드 + frontend/package.json)에서 프론트 마커가 백엔드 감지를
가로채지 않는 것이 핵심 경계다.
"""

from app.deploy import runtimes
from app.deploy.build.github import _RUNTIME_MARKERS, _choose_build_target


def _tree(*paths):
    return [{"type": "blob", "path": p} for p in paths]


# --- Dockerfile 우선 ---

def test_root_dockerfile_wins_over_markers():
    tree = _tree("Dockerfile", "requirements.txt")
    assert _choose_build_target(tree, "", "python") == ("dockerfile", "Dockerfile")


def test_dockerfile_closest_to_root_wins():
    tree = _tree("a/b/Dockerfile", "a/Dockerfile")
    assert _choose_build_target(tree, "", "python") == ("dockerfile", "a/Dockerfile")


# --- nixpacks 마커 → 디렉토리 ---

def test_root_marker_returns_empty_path():
    assert _choose_build_target(_tree("requirements.txt"), "", "python") == ("auto", "")


def test_subdir_marker_returns_its_dir():
    tree = _tree("server/pom.xml")
    assert _choose_build_target(tree, "", "java") == ("auto", "server")


def test_js_root_package_json_detected():
    assert _choose_build_target(_tree("package.json"), "", "javascript") == ("auto", "")


def test_js_monorepo_subdir_detected():
    tree = _tree("README.md", "server/package.json")
    assert _choose_build_target(tree, "", "javascript") == ("auto", "server")


# --- 선택 런타임 마커 우선 — 풀스택 repo 경계 ---

def test_python_runtime_ignores_closer_frontend_package_json():
    # root package.json(워크스페이스 도구 등)이 있어도 python 선택이면 backend를 잡는다.
    tree = _tree("package.json", "backend/requirements.txt")
    assert _choose_build_target(tree, "", "python") == ("auto", "backend")


def test_js_runtime_prefers_package_json_over_other_markers():
    tree = _tree("scripts/requirements.txt", "web/package.json")
    assert _choose_build_target(tree, "", "javascript") == ("auto", "web")


def test_no_preferred_marker_falls_back_to_any():
    # 선택 런타임 마커가 없으면 기존처럼 아무 마커나 root 가까운 것.
    tree = _tree("app/composer.json")
    assert _choose_build_target(tree, "", "python") == ("auto", "app")


# --- 스코프/깊이/제외 규칙 ---

def test_project_path_scopes_search():
    tree = _tree("Dockerfile", "sub/requirements.txt")
    assert _choose_build_target(tree, "sub", "python") == ("auto", "sub")


def test_depth_over_three_excluded():
    assert _choose_build_target(_tree("a/b/c/d/Dockerfile"), "", "python") is None


def test_non_blob_ignored():
    tree = [{"type": "tree", "path": "Dockerfile"}]
    assert _choose_build_target(tree, "", "python") is None


def test_no_match_returns_none():
    assert _choose_build_target(_tree("README.md"), "", "python") is None


# --- 마커 테이블 자체의 계약 ---

def test_all_selectable_runtimes_have_markers():
    # 런타임 추가 시 마커 등록을 빠뜨리면 여기서 잡힌다 (javascript 누락이 실제 있었음).
    for rt in runtimes.SELECTABLE_RUNTIMES:
        if rt == "static":                # 정적 슬롯은 detect 대상 아님 (build_mode="static")
            continue
        assert _RUNTIME_MARKERS.get(rt), f"{rt} 마커 없음"
