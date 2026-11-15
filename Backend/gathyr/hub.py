"""WebSocket connections.

Each connection owns an outbound queue drained by its own task, so one slow
client can never stall a broadcast to everyone else. A client that falls too far
behind is disconnected; it reconnects and receives a fresh snapshot.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Optional

from fastapi import WebSocket

log = logging.getLogger("gathyr.hub")

# Application close codes (4000-4999 are reserved for apps)
CLOSE_REPLACED = 4001        # same participant opened another tab/device
CLOSE_KICKED = 4003
CLOSE_INVALID_SESSION = 4004
CLOSE_AUTH_TIMEOUT = 4008
CLOSE_SLOW_CONSUMER = 4013
CLOSE_RATE_LIMITED = 4029


def encode(message: dict[str, Any]) -> str:
    return json.dumps(message, separators=(",", ":"), ensure_ascii=False)


class Connection:
    MAX_QUEUE = 512

    def __init__(self, ws: WebSocket, room_code: str, participant_id: str):
        self.ws = ws
        self.room_code = room_code
        self.participant_id = participant_id
        self.closed = False
        self._queue: asyncio.Queue[Optional[str]] = asyncio.Queue(maxsize=self.MAX_QUEUE)
        self._task: Optional[asyncio.Task] = None
        # token bucket for inbound messages
        self._tokens = 120.0
        self._last_refill = time.monotonic()

    def start(self) -> None:
        self._task = asyncio.create_task(self._sender())

    def send(self, message: dict[str, Any] | str) -> None:
        if self.closed:
            return
        data = message if isinstance(message, str) else encode(message)
        try:
            self._queue.put_nowait(data)
        except asyncio.QueueFull:
            log.warning("slow consumer, dropping %s", self.participant_id)
            asyncio.get_running_loop().create_task(self.close(CLOSE_SLOW_CONSUMER, "too slow"))

    def allow_inbound(self, rate: float = 60.0, burst: float = 120.0) -> bool:
        now = time.monotonic()
        self._tokens = min(burst, self._tokens + (now - self._last_refill) * rate)
        self._last_refill = now
        if self._tokens < 1:
            return False
        self._tokens -= 1
        return True

    async def _sender(self) -> None:
        try:
            while True:
                data = await self._queue.get()
                if data is None:
                    break
                await self.ws.send_text(data)
        except Exception:  # socket gone — receive loop will clean up
            pass
        finally:
            self.closed = True

    async def close(self, code: int = 1000, reason: str = "") -> None:
        if self.closed:
            return
        self.closed = True
        try:
            await self.ws.close(code=code, reason=reason)
        except Exception:
            pass
        if self._task:
            self._task.cancel()


class Hub:
    """participant_id -> live connection (at most one per participant)."""

    def __init__(self) -> None:
        self._by_participant: dict[str, Connection] = {}

    def attach(self, conn: Connection) -> Optional[Connection]:
        previous = self._by_participant.get(conn.participant_id)
        self._by_participant[conn.participant_id] = conn
        return previous if previous is not conn else None

    def detach(self, conn: Connection) -> bool:
        """Returns True only if `conn` was the participant's current connection."""
        if self._by_participant.get(conn.participant_id) is conn:
            del self._by_participant[conn.participant_id]
            return True
        return False

    def get(self, participant_id: str) -> Optional[Connection]:
        return self._by_participant.get(participant_id)

    def send(self, participant_id: str, message: dict[str, Any] | str) -> None:
        conn = self._by_participant.get(participant_id)
        if conn:
            conn.send(message)
