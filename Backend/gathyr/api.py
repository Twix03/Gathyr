"""HTTP + WebSocket endpoints."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .config import settings
from .hub import CLOSE_AUTH_TIMEOUT, CLOSE_INVALID_SESSION, CLOSE_RATE_LIMITED, Connection
from .rooms import Participant, Room, RoomError, manager

log = logging.getLogger("gathyr.api")
router = APIRouter()

MAX_WS_MESSAGE = 64 * 1024


class NameBody(BaseModel):
    name: str = Field(..., max_length=64)


class FeedbackBody(BaseModel):
    type: Literal["bug", "suggestion"]
    text: str = Field(..., min_length=1, max_length=2000)
    room_code: Optional[str] = Field(None, max_length=10)


def _bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing session token.")
    return authorization[7:].strip()


def _session_response(room: Room, p: Participant) -> dict:
    return {
        "room": manager.snapshot(room),
        "participant": p.public(),
        "session_token": p.token,
        "livekit_token": manager.livekit_token(room, p),
    }


def _guard(fn, *args):
    try:
        return fn(*args)
    except RoomError as e:
        raise HTTPException(e.status, e.message)


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "rooms": len(manager.rooms)}


@router.post("/api/rooms", status_code=201)
async def create_room(body: NameBody) -> dict:
    room, p = _guard(manager.create_room, body.name)
    return _session_response(room, p)


@router.get("/api/rooms/{code}")
async def room_preview(code: str) -> dict:
    """Public preview for the join screen — no participant IDs."""
    room = manager.get_room(code)
    if not room:
        raise HTTPException(404, "That room doesn't exist or has ended.")
    return {
        "code": room.code,
        "participant_count": len(room.participants),
        "names": [p.name for p in room.participants.values()][:6],
        "full": len(room.participants) >= settings.max_room_participants,
        "game": room.game.name if room.game else None,
    }


@router.post("/api/rooms/{code}/join")
async def join_room(code: str, body: NameBody) -> dict:
    room, p = _guard(manager.join_room, code, body.name)
    return _session_response(room, p)


@router.post("/api/rooms/{code}/session")
async def resume_session(code: str, authorization: Optional[str] = Header(None)) -> dict:
    room, p = _guard(manager.resume, code, _bearer(authorization))
    return _session_response(room, p)


@router.delete("/api/rooms/{code}/session", status_code=204, response_class=Response)
async def leave_room(code: str, authorization: Optional[str] = Header(None)):
    _guard(manager.leave, code, _bearer(authorization))
    return Response(status_code=204)


# ---------------------------------------------------------------- feedback
_feedback_hits: dict[str, deque] = defaultdict(deque)


@router.post("/api/feedback", status_code=201)
async def feedback(body: FeedbackBody, request: Request) -> dict:
    ip = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
    now = time.time()
    hits = _feedback_hits[ip]
    while hits and now - hits[0] > 600:
        hits.popleft()
    if len(hits) >= 5:
        raise HTTPException(429, "Too many submissions — try again in a few minutes.")
    hits.append(now)
    path = Path(settings.feedback_path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)), **body.model_dump()}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"status": "ok"}


# ---------------------------------------------------------------- websocket
@router.websocket("/ws/room/{code}")
async def room_socket(ws: WebSocket, code: str) -> None:
    """Protocol: client's first message must be {"type":"auth","token":...}."""
    await ws.accept()
    try:
        first = await asyncio.wait_for(ws.receive_text(), timeout=10)
        token = json.loads(first).get("token")
        room, p = manager.resume(code, token)
    except asyncio.TimeoutError:
        await ws.close(CLOSE_AUTH_TIMEOUT, "auth timeout")
        return
    except (RoomError, ValueError, AttributeError, WebSocketDisconnect):
        try:
            await ws.close(CLOSE_INVALID_SESSION, "invalid session")
        except Exception:
            pass
        return

    conn = Connection(ws, room.code, p.id)
    conn.start()
    manager.connect(conn)
    strikes = 0
    try:
        while True:
            text = await ws.receive_text()
            if len(text) > MAX_WS_MESSAGE:
                continue
            if not conn.allow_inbound():
                strikes += 1
                if strikes > 200:
                    await conn.close(CLOSE_RATE_LIMITED, "rate limited")
                    break
                continue
            try:
                message = json.loads(text)
            except ValueError:
                continue
            if isinstance(message, dict):
                manager.handle(conn, message)
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("socket error in %s", code)
    finally:
        conn.closed = True
        manager.disconnect(conn)
