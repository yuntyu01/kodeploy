"""유저 의존성(mysql 등) 매니페스트 빌더."""

import secrets

from app.deploy.manifests._renderer import render_all
from app.deploy.runtimes import get_resources


# mysql 의존성 한 묶음 — Secret + Service + StatefulSet 3개 dict 반환.
# 비번은 매 호출마다 새로 생성 (멱등 X) — 호출 측에서 "없을 때만 생성" 가드 필요.
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
        req_cpu=res["req_cpu"],
        lim_cpu=res["lim_cpu"],
        req_mem=res["req_mem"],
        lim_mem=res["lim_mem"],
    )


# postgres 의존성 한 묶음 — Secret + Service + StatefulSet.
# mysql과 동일 컨벤션: DB_HOST=postgres, port 5432. envFrom으로 앱에 주입.
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
        req_cpu=res["req_cpu"],
        lim_cpu=res["lim_cpu"],
        req_mem=res["req_mem"],
        lim_mem=res["lim_mem"],
    )
