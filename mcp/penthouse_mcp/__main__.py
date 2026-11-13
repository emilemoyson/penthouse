"""penthouse-mcp            STDIO (Claude Code, Claude Desktop)
penthouse-mcp --http     StreamableHTTP on http://127.0.0.1:8765/mcp, needs MCP_HTTP_TOKEN"""

from __future__ import annotations

import argparse
import sys
import warnings


def main() -> None:
    ap = argparse.ArgumentParser(prog="penthouse-mcp")
    ap.add_argument("--http", action="store_true", help="serve StreamableHTTP instead of STDIO")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    # sampling and roots are deprecated in the 2026-07-28 spec but still supported; keep stderr quiet
    warnings.filterwarnings("ignore", category=DeprecationWarning)

    from . import config
    from .server import app

    if not args.http:
        app.run("stdio")
        return

    import uvicorn

    from .http_auth import BearerAuth

    token = config.load().http_token
    if not token:
        sys.exit("Set MCP_HTTP_TOKEN in mcp/.env (at least 24 characters) to serve over HTTP.")
    asgi = BearerAuth(app.streamable_http_app(host=args.host), token)
    uvicorn.run(asgi, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
