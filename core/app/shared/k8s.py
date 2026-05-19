"""K8s API 클라이언트 lazy-loader.

import 시점에 K8s 설정을 읽지 않고, 첫 호출에서 한 번만 로드한다.
- 클러스터 안에서 돌면 ServiceAccount 토큰 기반(in-cluster) 설정,
- 로컬 개발 등 클러스터 밖이면 ~/.kube/config로 fallback.
"""

from kubernetes import client, config

_loaded = False


# K8s 설정 lazy 로드 (in-cluster 우선, 실패 시 ~/.kube/config fallback)
def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    _loaded = True


# BuildKit Job 생성/조회용
def batch_v1() -> client.BatchV1Api:
    _ensure_loaded()
    return client.BatchV1Api()


# Pod 로그·Service 조회/생성용
def core_v1() -> client.CoreV1Api:
    _ensure_loaded()
    return client.CoreV1Api()


# Deployment 생성/패치용
def apps_v1() -> client.AppsV1Api:
    _ensure_loaded()
    return client.AppsV1Api()


# Gateway API 등 CRD 조작용
def custom() -> client.CustomObjectsApi:
    _ensure_loaded()
    return client.CustomObjectsApi()
