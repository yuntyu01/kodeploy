"""정적 미정의 이름 검사 — import 누락은 그 함수가 실행되기 전까지 안 터진다.

_run_build 같은 백그라운드 경로는 유닛 테스트가 전부 실행하지 않으므로,
pyflakes의 undefined-name 검출로 전 모듈을 정적으로 커버한다.
(실제 사고: service.py 분리 때 _ensure_tenant_ns import 누락 — 테스트 156개
전체 통과 후 운영 첫 빌드에서 NameError로 표면화. 이 검사가 있었으면 커밋 전에 잡혔다.)
"""

import io
from pathlib import Path

from pyflakes.api import checkRecursive
from pyflakes.reporter import Reporter

APP_DIR = Path(__file__).resolve().parent.parent / "app"


def test_no_undefined_names_in_app():
    out, err = io.StringIO(), io.StringIO()
    checkRecursive([str(APP_DIR)], Reporter(out, err))

    # unused-import 등 스타일 경고는 통과 — 실행 시 NameError가 되는 것만 게이트
    problems = [
        line
        for line in out.getvalue().splitlines()
        if "undefined name" in line or "referenced before assignment" in line
    ]
    assert problems == [], "\n".join(problems)
    assert err.getvalue() == ""  # 문법 에러/파싱 실패
