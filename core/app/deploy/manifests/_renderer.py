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


# 단일 템플릿 렌더 + yaml 파싱
def render(template_name: str, **vars) -> dict:
    template = _env.get_template(template_name)
    rendered = template.render(**vars)
    return yaml.safe_load(rendered)
