"""items 도메인 DTO. ORM 모델과 외부 입출력 스키마를 분리한다."""

from pydantic import BaseModel


class ItemIn(BaseModel):
    # 생성 요청 — 클라이언트가 보내는 필드만.
    name: str


class ItemOut(BaseModel):
    # 응답 — DB에서 채워진 id 포함.
    id: int
    name: str
