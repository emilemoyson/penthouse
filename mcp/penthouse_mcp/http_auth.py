"""Bearer-token gate in front of the StreamableHTTP app. Every request needs Authorization: Bearer $MCP_HTTP_TOKEN."""

from __future__ import annotations

import hmac

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class BearerAuth:
    def __init__(self, app: ASGIApp, token: str):
        if len(token) < 24:
            raise ValueError("MCP_HTTP_TOKEN must be at least 24 characters.")
        self.app = app
        self.token = token.encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            header = dict(scope.get("headers") or {}).get(b"authorization", b"")
            got = header[7:] if header[:7].lower() == b"bearer " else b""
            if not hmac.compare_digest(got, self.token):
                await JSONResponse({"error": "unauthorized"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})(scope, receive, send)
                return
        await self.app(scope, receive, send)
