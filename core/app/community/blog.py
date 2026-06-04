"""velog RSS 프록시 — 블로그 글 목록.

브라우저에서 velog RSS를 직접 fetch하면 CORS에 막히므로 백엔드가 대신 가져온다.
deploy.service.fetch_recent_commits(GitHub API 프록시)와 같은 철학 —
실패는 조용히 처리(stale 캐시 또는 빈 리스트), UI에서 "없음" 표시되면 충분.

velog RSS 구조 (v2.velog.io/rss/@{user}):
- item: title / link / pubDate(RFC 822) / description(CDATA HTML 본문 전체)
- 태그(category) 없음 — 응답에도 tags 미포함.
- 썸네일 필드 없음 — description HTML의 첫 <img src>를 썸네일로 사용.

글 갱신 빈도가 낮으므로 메모리 TTL 캐시(1시간)로 velog 호출을 줄인다.
core Pod 재시작 시 캐시가 비는 건 무해 — 첫 요청이 다시 채움.
"""

from __future__ import annotations

import html
import re
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import httpx

VELOG_RSS_URL = "https://v2.velog.io/rss/@yun60"
VELOG_SERIES_URL = "https://velog.io/@yun60/series/KoDeploy"
CACHE_TTL_SECONDS = 3600
DESCRIPTION_MAX = 160

# (fetched_at, posts) — 모듈 레벨 단일 캐시. 피드가 하나뿐이라 dict 불필요.
_cache: tuple[float, list[dict]] | None = None

_IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"')
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


# description HTML → 요약 텍스트. 태그 제거 → entity 복원 → 공백 정리 → 길이 cap.
def _summarize_html(desc_html: str) -> str:
    text = _TAG_RE.sub(" ", desc_html)
    text = html.unescape(text)
    text = _WS_RE.sub(" ", text).strip()
    if len(text) > DESCRIPTION_MAX:
        text = text[:DESCRIPTION_MAX].rstrip() + "…"
    return text


# RSS <item> → 프론트 카드용 dict. 필수 필드(title/link) 없으면 None.
# _ts는 최신순 정렬용 내부 키 — fetch_blog_posts가 정렬 후 제거하고 응답엔 안 나감.
def _parse_item(item: ET.Element) -> dict | None:
    title = (item.findtext("title") or "").strip()
    url = (item.findtext("link") or "").strip()
    if not title or not url:
        return None

    desc_html = item.findtext("description") or ""
    img = _IMG_RE.search(desc_html)

    dt = None
    pub = item.findtext("pubDate")
    if pub:
        try:
            dt = parsedate_to_datetime(pub)
        except (TypeError, ValueError):
            pass

    return {
        "title": title,
        "url": url,
        "thumbnail": img.group(1) if img else None,
        "date": dt.strftime("%Y.%m.%d") if dt else "",
        "description": _summarize_html(desc_html),
        "_ts": dt.timestamp() if dt else 0.0,
    }


# 블로그 글 목록 (RSS 최신순 그대로). 캐시 유효하면 캐시, 아니면 fetch 후 갱신.
# fetch 실패 시 stale 캐시라도 반환 — velog 장애가 소통 페이지를 비우지 않게.
def fetch_blog_posts() -> list[dict]:
    global _cache
    now = time.time()
    if _cache and now - _cache[0] < CACHE_TTL_SECONDS:
        return _cache[1]

    try:
        resp = httpx.get(VELOG_RSS_URL, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except (httpx.HTTPError, ET.ParseError):
        return _cache[1] if _cache else []

    posts = [p for p in (_parse_item(i) for i in root.iter("item")) if p]
    # RSS는 보통 최신순이지만 보장이 아님 — pubDate 기준 최신순 명시 정렬.
    posts.sort(key=lambda p: p["_ts"], reverse=True)
    for p in posts:
        p.pop("_ts")
    _cache = (now, posts)
    return posts
