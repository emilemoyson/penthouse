"""Settings from the environment, then mcp/.env, then scripts/.env (INGEST_* only).

Values are never printed or returned by a tool. Only whether a value is set is ever reported.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

MCP_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = MCP_DIR.parent


def _read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


@dataclass(frozen=True)
class Settings:
    db_url: str | None
    ingest_url: str | None
    ingest_token: str | None
    http_token: str | None


def load() -> Settings:
    local = _read_env_file(MCP_DIR / ".env")
    scripts = _read_env_file(REPO_DIR / "scripts" / ".env")

    def pick(key: str, *fallbacks: dict[str, str]) -> str | None:
        return os.environ.get(key) or local.get(key) or next((f[key] for f in fallbacks if f.get(key)), None)

    return Settings(
        db_url=pick("PENTHOUSE_RO_DATABASE_URL"),
        ingest_url=pick("INGEST_URL", scripts),
        ingest_token=pick("INGEST_TOKEN", scripts),
        http_token=pick("MCP_HTTP_TOKEN"),
    )
