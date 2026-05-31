"""유저 의존성(mysql/postgres/redis) 매니페스트 빌더."""

import secrets

from app.deploy.manifests._renderer import render_all
from app.deploy.runtimes import get_resources


def mysql(
    tenant_id: str,
    user_id: str,
    database: str = "app",
    username: str = "app",
) -> list[dict]:
    res = get_resources("mysql")
    return render_all(
        "dependencies/mysql.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        database=database,
        username=username,
        root_password=secrets.token_urlsafe(24),
        password=secrets.token_urlsafe(24),
        **res,
    )


def postgres(
    tenant_id: str,
    user_id: str,
    database: str = "app",
    username: str = "app",
) -> list[dict]:
    res = get_resources("postgres")
    return render_all(
        "dependencies/postgres.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        database=database,
        username=username,
        password=secrets.token_urlsafe(24),
        **res,
    )


def redis(tenant_id: str, user_id: str) -> list[dict]:
    res = get_resources("redis")
    return render_all(
        "dependencies/redis.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        password=secrets.token_urlsafe(24),
        **res,
    )


# R2 스토리지 Secret — mysql/redis와 달리 K8s 워크로드가 아니라 Secret 1개뿐.
# 자격증명(env)과 token_id는 호출 측이 r2.provision()으로 받아 넘긴다 (CF API 산출물).
def storage(
    tenant_id: str, user_id: str, env: dict[str, str], token_id: str
) -> list[dict]:
    return render_all(
        "dependencies/r2-secret.yaml.j2",
        tenant_id=tenant_id,
        user_id=user_id,
        env=env,
        token_id=token_id,
    )
