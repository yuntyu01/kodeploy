"""메트릭 range 설정 정합 — RANGE_SECONDS와 STEP_SECONDS 키 드리프트 방지.

프론트(MonitoringPanel RANGES)가 보내는 range 키가 두 dict 모두에 있어야
query_range가 기본값으로 조용히 강등되지 않는다.
"""

from app.deploy.console import metrics


def test_range_and_step_keys_match():
    assert set(metrics.RANGE_SECONDS) == set(metrics.STEP_SECONDS)


def test_steps_do_not_exceed_ranges():
    # step이 range보다 크면 데이터포인트 0~1개 — 그래프가 그려질 수 없는 설정 오류
    for key, total in metrics.RANGE_SECONDS.items():
        assert metrics.STEP_SECONDS[key] < total
