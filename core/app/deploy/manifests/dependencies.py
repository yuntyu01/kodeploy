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
