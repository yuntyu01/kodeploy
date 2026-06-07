"""Jinja2 템플릿(templates/*.yaml.j2) → 렌더 → YAML 파싱 → dict 변환."""

from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader

_TEMPLATES_DIR = Path(__file__).parent / "templates"

# autoescape는 HTML용 — YAML 렌더에는 비활성화
_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    keep_trailing_newline=True,
    autoescape=False,
)


# 단일 문서 템플릿 렌더 + yaml 파싱 (deployment/service 같은 단일 리소스용)
def render(template_name: str, **vars) -> dict:
    template = _env.get_template(template_name)
    rendered = template.render(**vars)
    return yaml.safe_load(rendered)


# 다중 문서 템플릿 렌더 (tenant: ns + ResourceQuota + Secret 같은 묶음)
# yaml의 `---` 구분자로 분리된 문서 여러 개를 list로 반환.
def render_all(template_name: str, **vars) -> list[dict]:
    template = _env.get_template(template_name)
    rendered = template.render(**vars)
    return [doc for doc in yaml.safe_load_all(rendered) if doc]


# YAML 아닌 텍스트 템플릿 렌더 (static_dockerfile.j2 — Dockerfile 본문)
def render_text(template_name: str, **vars) -> str:
    return _env.get_template(template_name).render(**vars)
