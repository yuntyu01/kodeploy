"""add users.github_installation_id — GitHub App installation token (private repo clone).

유저가 KoDeploy GitHub App을 자기 repo에 설치하면 OAuth 콜백에 installation_id가 실려 온다.
이 값을 유저에 저장해 두고, 빌드 시점에 그 installation의 access token(1h, repo-scoped)을 발급해
private repo를 clone한다. None이면 App 미설치 → public repo만 (기존 동작).

Revision ID: 013
Revises: 012
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("github_installation_id", sa.BigInteger(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "github_installation_id")
