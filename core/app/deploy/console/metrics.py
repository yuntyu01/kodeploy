"""유저 앱 메트릭 조회 — VictoriaMetrics query/query_range 프록시.

cadvisor(CPU/Memory/Network), kube-state-metrics(restarts/limits/OOM),
Envoy Gateway(RPS/latency/error rate)를 tenant namespace + app name으로 필터링.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

VM_URL = os.environ.get("VM_URL", "http://victoriametrics.monitoring.svc:8428")

RANGE_SECONDS = {
    "15m": 900,
    "1h": 3600,
    "6h": 21600,
    "1d": 86400,
    "3d": 259200,
    "7d": 604800,
    "14d": 1209600,
    "30d": 2592000,
}

STEP_SECONDS = {
    "15m": 15,
    "1h": 60,
    "6h": 120,
    "1d": 300,
    "3d": 900,
    "7d": 1800,
    "14d": 3600,
    "30d": 7200,
}


def _query_instant(query: str) -> float | None:
    params = urllib.parse.urlencode({"query": query})
    url = f"{VM_URL}/api/v1/query?{params}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    results = data.get("data", {}).get("result", [])
    if not results:
        return None
    return float(results[0].get("value", [0, 0])[1])


def _query_range(query: str, range_key: str) -> list[dict]:
    end = time.time()
    start = end - RANGE_SECONDS.get(range_key, 3600)
    step = STEP_SECONDS.get(range_key, 60)

    params = urllib.parse.urlencode({
        "query": query,
        "start": int(start),
        "end": int(end),
        "step": step,
    })
    url = f"{VM_URL}/api/v1/query_range?{params}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return []

    results = data.get("data", {}).get("result", [])
    if not results:
        return []
    values = results[0].get("values", [])
    return [{"ts": v[0], "value": float(v[1])} for v in values]


def _envoy_cluster(tenant_id: str, app_name: str) -> str:
    return f'httproute/{tenant_id}/{app_name}/rule/0'


def fetch_app_metrics(tenant_id: str, app_name: str, range_key: str = "1h") -> dict:
    pod_filter = f'namespace="{tenant_id}",pod=~"{app_name}-.*",container="app"'
    net_filter = f'namespace="{tenant_id}",pod=~"{app_name}-.*"'
    envoy_cluster = _envoy_cluster(tenant_id, app_name)
    ec = f'envoy_cluster_name="{envoy_cluster}"'

    queries = {
        # --- range ---
        "cpu": (f'rate(container_cpu_usage_seconds_total{{{pod_filter}}}[2m])', "range"),
        "memory": (f'container_memory_working_set_bytes{{{pod_filter}}}', "range"),
        "restarts": (f'kube_pod_container_status_restarts_total{{{pod_filter}}}', "range"),
        "net_rx": (f'rate(container_network_receive_bytes_total{{{net_filter}}}[2m])', "range"),
        "net_tx": (f'rate(container_network_transmit_bytes_total{{{net_filter}}}[2m])', "range"),
        "rps": (f'rate(envoy_cluster_upstream_rq_total{{{ec}}}[5m]) or vector(0)', "range"),
        "error_rate": (
            f'sum(rate(envoy_cluster_upstream_rq_xx{{{ec},envoy_response_code_class=~"4|5"}}[5m])) or vector(0)',
            "range",
        ),
        "latency_p50": (
            f'histogram_quantile(0.50, sum(rate(envoy_cluster_upstream_rq_time_bucket{{{ec}}}[5m])) by (le)) or vector(0)',
            "range",
        ),
        "latency_p95": (
            f'histogram_quantile(0.95, sum(rate(envoy_cluster_upstream_rq_time_bucket{{{ec}}}[5m])) by (le)) or vector(0)',
            "range",
        ),
        # --- instant ---
        "cpu_now": (f'rate(container_cpu_usage_seconds_total{{{pod_filter}}}[2m])', "instant"),
        "mem_now": (f'container_memory_working_set_bytes{{{pod_filter}}}', "instant"),
        "cpu_limit": (
            f'kube_pod_container_resource_limits{{{pod_filter},resource="cpu"}}',
            "instant",
        ),
        "mem_limit": (
            f'kube_pod_container_resource_limits{{{pod_filter},resource="memory"}}',
            "instant",
        ),
        "restart_total": (f'kube_pod_container_status_restarts_total{{{pod_filter}}}', "instant"),
        "oom_total": (
            f'kube_pod_container_status_last_terminated_reason{{{pod_filter},reason="OOMKilled"}}',
            "instant",
        ),
    }

    with ThreadPoolExecutor(max_workers=len(queries)) as pool:
        futures = {}
        for key, (query, qtype) in queries.items():
            if qtype == "range":
                futures[key] = pool.submit(_query_range, query, range_key)
            else:
                futures[key] = pool.submit(_query_instant, query)

    return {k: f.result() for k, f in futures.items()}
