"""커스텀 도메인 정규화 + PSL apex 판정 가정 고정.

set_custom_domain의 apex 거절은 "PSL.privatesuffix(d)가 d 자신이면 apex"라는
라이브러리 동작 가정 위에 서 있다 (service.py의 _PSL 주석 — co.kr 같은 복합 TLD 때문에
라벨 수 세기 대신 PSL). 그 가정을 테스트로 박아 라이브러리 업데이트 시 드러나게 한다.
"""

import pytest

from app.deploy import service as svc


# --- _normalize_domain ---

def test_normalize_lowercases_and_strips_trailing_dot():
    assert svc._normalize_domain(" App.Example.COM. ") == "app.example.com"


@pytest.mark.parametrize("domain", [
    "kodeploy.com",            # 자사 도메인 — 자동 제공이라 거절
    "sub.kodeploy.com",
    "under_score.com",         # 형식 위배
    "-bad.com",
    "nodot",                   # 라벨 1개
    "a" * 250 + ".com",        # 253자 초과
])
def test_normalize_rejects(domain):
    with pytest.raises(ValueError):
        svc._normalize_domain(domain)


def test_normalize_accepts_subdomain():
    assert svc._normalize_domain("a.b.example.com") == "a.b.example.com"


# --- PSL apex 판정 가정 (set_custom_domain의 거절 로직이 의존) ---

def test_psl_apex_is_itself():
    assert svc._PSL.privatesuffix("example.com") == "example.com"
    assert svc._PSL.privatesuffix("example.co.kr") == "example.co.kr"  # 라벨 3개지만 apex


def test_psl_subdomain_returns_parent():
    assert svc._PSL.privatesuffix("app.example.com") == "example.com"
    assert svc._PSL.privatesuffix("app.example.co.kr") == "example.co.kr"


def test_psl_public_suffix_itself_is_none():
    assert svc._PSL.privatesuffix("co.kr") is None
