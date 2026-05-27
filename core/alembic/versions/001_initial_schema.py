"""initial schema — baseline for existing DB.

Revision ID: 001
Revises: None

Existing tables: users, sessions, builds, posts, comments.
On a fresh DB this creates everything. On an existing DB (production)
it skips tables that already exist via information_schema check.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGTEXT

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = :name"
    ), {"name": name})
    return result.fetchone() is not None


def upgrade() -> None:
    if not _table_exists("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("github_id", sa.BigInteger(), unique=True, index=True, nullable=False),
            sa.Column("login", sa.String(100), nullable=False),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("avatar_url", sa.String(500), nullable=True),
            sa.Column("app_name", sa.String(50), nullable=True, unique=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    if not _table_exists("sessions"):
        op.create_table(
            "sessions",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), index=True, nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("user_agent", sa.String(255), nullable=True),
            sa.Column("ip", sa.String(45), nullable=True),
        )
        op.create_index("ix_sessions_user_expires", "sessions", ["user_id", "expires_at"])

    if not _table_exists("builds"):
        op.create_table(
            "builds",
            sa.Column("build_id", sa.String(8), primary_key=True),
            sa.Column("repo_url", sa.String(500), nullable=False),
            sa.Column("branch", sa.String(100), nullable=False),
            sa.Column("image", sa.String(500), nullable=False),
            sa.Column("app_name", sa.String(50), nullable=False),
            sa.Column("port", sa.Integer(), nullable=False),
            sa.Column("runtime", sa.String(20), nullable=False),
            sa.Column("db_type", sa.String(20), nullable=False, server_default="none"),
            sa.Column("kind", sa.String(20), nullable=False, server_default="build"),
            sa.Column("build_mode", sa.String(20), nullable=False, server_default="dockerfile"),
            sa.Column("dockerfile_path", sa.String(200), nullable=False, server_default="Dockerfile"),
            sa.Column("project_path", sa.String(200), nullable=False, server_default=""),
            sa.Column("dockerfile_content", LONGTEXT(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("analysis", sa.Text(), nullable=True),
            sa.Column("logs", LONGTEXT(), nullable=True),
            sa.Column("user_id", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    if not _table_exists("posts"):
        op.create_table(
            "posts",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("is_secret", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    if not _table_exists("comments"):
        op.create_table(
            "comments",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("post_id", sa.Integer(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("is_secret", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("comments")
    op.drop_table("posts")
    op.drop_table("builds")
    op.drop_table("sessions")
    op.drop_table("users")
