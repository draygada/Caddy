"""Bounded ASGI entrypoint for Vercel and OCI deployment."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from cad_service.app import app as cad_service_app


VERCEL_DOCUMENTED_BODY_LIMIT_BYTES = 4_500_000
SERVICE_BODY_LIMIT_BYTES = 4_250_000

Scope = dict[str, Any]
Message = dict[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class ResponsePayloadTooLarge(Exception):
    """Raised before a buffered response crosses the service transport ceiling."""


async def _send_json(send: Send, status: int, code: str, message: str, limit: int) -> None:
    body = json.dumps(
        {"status": "FAILED", "code": code, "message": message, "limit_bytes": limit},
        separators=(",", ":"),
    ).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
                (b"x-caddydaddy-payload-limit", str(limit).encode("ascii")),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body, "more_body": False})


class BoundedPayloadASGI:
    """Fail closed below the provider's request and response body limits."""

    def __init__(
        self,
        inner: ASGIApp,
        *,
        max_request_bytes: int = SERVICE_BODY_LIMIT_BYTES,
        max_response_bytes: int = SERVICE_BODY_LIMIT_BYTES,
    ) -> None:
        if max_request_bytes >= VERCEL_DOCUMENTED_BODY_LIMIT_BYTES:
            raise ValueError("request limit must preserve headroom below Vercel's limit")
        if max_response_bytes >= VERCEL_DOCUMENTED_BODY_LIMIT_BYTES:
            raise ValueError("response limit must preserve headroom below Vercel's limit")
        self.inner = inner
        self.max_request_bytes = max_request_bytes
        self.max_response_bytes = max_response_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.inner(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError:
                await _send_json(send, 400, "CONTENT_LENGTH_INVALID", "Content-Length must be an integer", self.max_request_bytes)
                return
            if declared_length > self.max_request_bytes:
                await _send_json(send, 413, "REQUEST_PAYLOAD_TOO_LARGE", "Request exceeds the CAD service transport limit", self.max_request_bytes)
                return

        request_body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            request_body.extend(message.get("body", b""))
            if len(request_body) > self.max_request_bytes:
                await _send_json(send, 413, "REQUEST_PAYLOAD_TOO_LARGE", "Request exceeds the CAD service transport limit", self.max_request_bytes)
                return
            if not message.get("more_body", False):
                break

        replayed = False

        async def replay_receive() -> Message:
            nonlocal replayed
            if replayed:
                return {"type": "http.disconnect"}
            replayed = True
            return {"type": "http.request", "body": bytes(request_body), "more_body": False}

        response_start: Message | None = None
        response_bodies: list[Message] = []
        response_size = 0

        async def capture_send(message: Message) -> None:
            nonlocal response_start, response_size
            if message["type"] == "http.response.start":
                response_start = message
                return
            if message["type"] == "http.response.body":
                response_size += len(message.get("body", b""))
                if response_size > self.max_response_bytes:
                    raise ResponsePayloadTooLarge
                response_bodies.append(message)

        try:
            await self.inner(scope, replay_receive, capture_send)
        except ResponsePayloadTooLarge:
            await _send_json(send, 413, "RESPONSE_PAYLOAD_TOO_LARGE", "Response exceeds the CAD service transport limit", self.max_response_bytes)
            return

        if response_start is None:
            await _send_json(send, 500, "ASGI_RESPONSE_INVALID", "Application did not start a response", self.max_response_bytes)
            return
        await send(response_start)
        for message in response_bodies:
            await send(message)


app = BoundedPayloadASGI(cad_service_app)
