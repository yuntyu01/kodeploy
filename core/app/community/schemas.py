"""community 도메인 입출력 스키마."""

from datetime import datetime

from pydantic import BaseModel


class PostCreate(BaseModel):
    content: str
    is_secret: bool = False


class CommentCreate(BaseModel):
    content: str
    is_secret: bool = False


class CommentOut(BaseModel):
    id: int
    post_id: int
    author: str
    content: str
    is_secret: bool
    is_mine: bool
    created_at: datetime


class PostOut(BaseModel):
    id: int
    author: str
    content: str
    is_secret: bool
    is_mine: bool
    comment_count: int
    created_at: datetime


class PostDetail(BaseModel):
    id: int
    author: str
    content: str
    is_secret: bool
    is_mine: bool
    comments: list[CommentOut]
    created_at: datetime
