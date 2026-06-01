"""Pod exec WebSocket 프록시 — 앱 터미널 + DB 터미널.

kubernetes_asyncio로 K8s exec WebSocket에 연결하고 FastAPI WebSocket과 양방향 중계.
REST 호출(Pod 조회 등)은 일반 ApiClient, exec만 WsApiClient 사용.
K8s exec WebSocket은 binary 프레임에 1바이트 채널 prefix를 붙임
(0=stdin, 1=stdout, 2=stderr). TTY 모드에선 출력이 stdout 채널로 합쳐짐.
"""

import asyncio
import base64
import json

import aiohttp
from fastapi import WebSocket, WebSocketDisconnect
from kubernetes_asyncio import client, config
from kubernetes_asyncio.stream import WsApiClient

_loaded = False


async def _ensure_loaded():
    global _loaded
    if _loaded:
        return
    try:
        config.load_incluster_config()
    except config.ConfigException:
        await config.load_kube_config()
    _loaded = True


async def _relay(ws: WebSocket, k8s_ws: aiohttp.ClientWebSocketResponse):
    async def k8s_to_ws():
        try:
            async for msg in k8s_ws:
                if msg.type == aiohttp.WSMsgType.BINARY and len(msg.data) > 1:
                    text = msg.data[1:].decode("utf-8", errors="replace")
                    if text:
                        await ws.send_text(text)
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSE,
                    aiohttp.WSMsgType.CLOSING,
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.ERROR,
                ):
                    break
        except Exception:
            pass

    async def ws_to_k8s():
        try:
            while True:
                data = await ws.receive_text()
                if k8s_ws.closed:
                    continue
                # 터미널 리사이즈 제어 메시지 → k8s exec resize 채널(4)로 pty 크기 전달.
                # 파드 안 프로그램(mysql 등)이 실제 터미널 폭에 맞춰 출력을 정렬하게 함.
                if data.startswith('{"__resize":'):
                    try:
                        dims = json.loads(data)["__resize"]
                        await k8s_ws.send_bytes(
                            b"\x04"
                            + json.dumps(
                                {"Width": int(dims["cols"]), "Height": int(dims["rows"])}
                            ).encode("utf-8")
                        )
                        continue
                    except (ValueError, KeyError, TypeError):
                        pass  # 파싱 실패 시 일반 입력으로 처리
                await k8s_ws.send_bytes(b"\x00" + data.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    tasks = [
        asyncio.create_task(k8s_to_ws()),
        asyncio.create_task(ws_to_k8s()),
    ]
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()
    except Exception:
        for t in tasks:
            t.cancel()
    finally:
        if not k8s_ws.closed:
            await k8s_ws.close()
        try:
            await ws.close()
        except Exception:
            pass


async def _find_app_pod(core: client.CoreV1Api, namespace: str, app_name: str) -> str | None:
    pods = await core.list_namespaced_pod(
        namespace=namespace,
        label_selector=f"app={app_name}",
    )
    running = [p for p in pods.items if p.status.phase == "Running"]
    if not running:
        return None
    pod = max(running, key=lambda p: (p.status.start_time or p.metadata.creation_timestamp).timestamp())
    return pod.metadata.name


async def _detect_db(core: client.CoreV1Api, namespace: str) -> tuple[str | None, str | None]:
    for db_type in ("mysql", "postgres"):
        pods = await core.list_namespaced_pod(
            namespace=namespace,
            label_selector=f"app={db_type}",
        )
        running = [p for p in pods.items if p.status.phase == "Running"]
        if running:
            return db_type, running[0].metadata.name
    return None, None


async def _get_db_password(core: client.CoreV1Api, namespace: str, db_type: str) -> str:
    secret_name = f"{db_type}-secret"
    try:
        secret = await core.read_namespaced_secret(name=secret_name, namespace=namespace)
        encoded = secret.data.get("DB_PASSWORD", "")
        return base64.b64decode(encoded).decode("utf-8")
    except Exception:
        return ""


async def _exec_and_relay(
    ws: WebSocket,
    ws_api: WsApiClient,
    pod_name: str,
    namespace: str,
    container: str,
    command: list[str],
):
    core = client.CoreV1Api(ws_api)
    try:
        cm = await core.connect_get_namespaced_pod_exec(
            name=pod_name,
            namespace=namespace,
            container=container,
            command=command,
            stderr=True, stdin=True, stdout=True, tty=True,
            _preload_content=False,
        )
    except Exception as e:
        await ws.send_text(f"\x1b[1;31mexec 실패: {e}\x1b[0m\r\n")
        await ws.close()
        return

    async with cm as k8s_ws:
        await _relay(ws, k8s_ws)


async def handle_terminal(ws: WebSocket, tenant_id: str, app_name: str):
    await ws.accept()
    await _ensure_loaded()

    async with client.ApiClient() as api:
        core = client.CoreV1Api(api)
        pod_name = await _find_app_pod(core, tenant_id, app_name)

    if not pod_name:
        await ws.send_text("\x1b[1;31mPod 없음\x1b[0m\r\n")
        await ws.close()
        return

    async with WsApiClient() as ws_api:
        await _exec_and_relay(
            ws, ws_api,
            pod_name=pod_name,
            namespace=tenant_id,
            container="app",
            command=["/bin/sh", "-c", f"export PS1='\\u@{app_name}\\$ '; command -v bash >/dev/null && exec bash --norc || exec sh"],
        )


async def handle_db_terminal(ws: WebSocket, tenant_id: str):
    await ws.accept()
    await _ensure_loaded()

    async with client.ApiClient() as api:
        core = client.CoreV1Api(api)
        db_type, pod_name = await _detect_db(core, tenant_id)
        if not db_type or not pod_name:
            await ws.send_text("\x1b[1;31mDB Pod 없음 — DB를 활성화하세요\x1b[0m\r\n")
            await ws.close()
            return
        password = await _get_db_password(core, tenant_id, db_type)

    if db_type == "mysql":
        # --default-character-set=utf8mb4: 패널(xterm, UTF-8)에서 한글 등 멀티바이트가
        # ?로 깨지지 않게 클라 연결 charset 고정. (컨테이너 로케일이 C면 mysql이 latin1로
        # 붙어서 결과를 ?로 변환하는 문제 방지)
        command = ["mysql", "--default-character-set=utf8mb4", "-u", "app", f"-p{password}", "app"]
    else:
        command = ["psql", "-U", "app", "app"]

    async with WsApiClient() as ws_api:
        await _exec_and_relay(
            ws, ws_api,
            pod_name=pod_name,
            namespace=tenant_id,
            container=db_type,
            command=command,
        )
