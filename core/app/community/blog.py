"""velog 시리즈 프록시 — 블로그 글 목록.

브라우저에서 velog API를 직접 호출하면 CORS에 막히므로 백엔드가 대신 가져온다.
deploy.build.github.fetch_recent_commits(GitHub API 프록시)와 같은 철학 —
실패는 조용히 처리(stale 캐시 또는 빈 리스트), UI에서 fallback 표시되면 충분.

RSS는 시리즈 필터·태그가 없어서, velog 웹 프론트가 쓰는 GraphQL
(v2.velog.io/graphql)의 series 쿼리로 KoDeploy 시리즈 글만 가져온다.
응답 post에 title/url_slug/thumbnail/short_description/released_at/tags가 그대로 옴.
⚠️ 비공식 API — velog가 스키마를 바꾸면 깨질 수 있다. 그 경우 빈 리스트로 강등되고
   UI는 시리즈 링크 fallback을 보여주므로 페이지 자체가 죽진 않는다.

글 갱신 빈도가 낮으므로 메모리 TTL 캐시(1시간)로 velog 호출을 줄인다.
core Pod 재시작 시 캐시가 비는 건 무해 — 첫 요청이 다시 채움.
"""

from __future__ import annotations

import re
import time
from datetime import datetime
from urllib.parse import quote

import httpx

VELOG_GRAPHQL_URL = "https://v2.velog.io/graphql"
VELOG_USERNAME = "yun60"
VELOG_SERIES_SLUG = "KoDeploy"
CACHE_TTL_SECONDS = 3600
DESCRIPTION_MAX = 160

_SERIES_QUERY = """
query GetSeries($username: String, $url_slug: String) {
  series(username: $username, url_slug: $url_slug) {
    series_posts {
      post {
        title
        url_slug
        thumbnail
        short_description
        released_at
        tags
      }
    }
  }
}
"""

# (fetched_at, posts) — 모듈 레벨 단일 캐시. 시리즈가 하나뿐이라 dict 불필요.
_cache: tuple[float, list[dict]] | None = None

_WS_RE = re.compile(r"\s+")


# GraphQL post → 프론트 카드용 dict. 필수 필드(title/url_slug) 없으면 None.
# _ts는 최신순 정렬용 내부 키 — fetch_blog_posts가 정렬 후 제거하고 응답엔 안 나감.
def _parse_post(post: dict) -> dict | None:
    title = (post.get("title") or "").strip()
    slug = post.get("url_slug") or ""
    if not title or not slug:
        return None

    date, ts = "", 0.0
    released = post.get("released_at") or ""
    try:
        dt = datetime.fromisoformat(released.replace("Z", "+00:00"))
        date, ts = dt.strftime("%Y.%m.%d"), dt.timestamp()
    except ValueError:
        pass

    desc = _WS_RE.sub(" ", post.get("short_description") or "").strip()
    if len(desc) > DESCRIPTION_MAX:
        desc = desc[:DESCRIPTION_MAX].rstrip() + "…"

    return {
        "title": title,
        # url_slug에 한글 포함 — 브라우저 호환 위해 인코딩한 정식 글 URL로 조립.
        "url": f"https://velog.io/@{VELOG_USERNAME}/{quote(slug)}",
        "thumbnail": post.get("thumbnail"),
        "date": date,
        "description": desc,
        "tags": post.get("tags") or [],
        "_ts": ts,
    }


# 시리즈 글 목록 (최신순). 캐시 유효하면 캐시, 아니면 fetch 후 갱신.
# fetch 실패 시 stale 캐시라도 반환 — velog 장애가 소통 페이지를 비우지 않게.
def fetch_blog_posts() -> list[dict]:
    global _cache
    now = time.time()
    if _cache and now - _cache[0] < CACHE_TTL_SECONDS:
        return _cache[1]

    try:
        resp = httpx.post(
            VELOG_GRAPHQL_URL,
            json={
                "query": _SERIES_QUERY,
                "variables": {
                    "username": VELOG_USERNAME,
                    "url_slug": VELOG_SERIES_SLUG,
                },
            },
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        series = (body.get("data") or {}).get("series") or {}
        series_posts = series.get("series_posts") or []
    except (httpx.HTTPError, ValueError):
        return _cache[1] if _cache else []

    posts = [
        parsed
        for sp in series_posts
        if isinstance(sp, dict) and (parsed := _parse_post(sp.get("post") or {}))
    ]
    # series_posts는 시리즈 회차순 — 최신 글이 위로 오게 released_at 기준 재정렬.
    posts.sort(key=lambda p: p["_ts"], reverse=True)
    for p in posts:
        p.pop("_ts")
    _cache = (now, posts)
    return posts
