"""Rooms: membership, presence, chat, votes and the active game.

All state lives in this process (single uvicorn worker). Everything that
changes the room is pushed to clients as a full `room_state` snapshot — rooms are
small, and snapshots make it impossible for a client to drift out of sync.
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import secrets
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable, Optional

from livekit.api import AccessToken, VideoGrants

from .config import settings
from .games import REGISTRY
from .games.base import ActionError, Game
from .hub import (CLOSE_KICKED, CLOSE_REPLACED, Connection, Hub, encode)

log = logging.getLogger("gathyr.rooms")

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I
NAME_RE = re.compile(r"\s+")


class RoomError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def clean_name(raw: str) -> str:
    name = NAME_RE.sub(" ", (raw or "")).strip()
    if not 1 <= len(name) <= 24:
        raise RoomError(422, "Name must be 1–24 characters.")
    return name


@dataclass
class Participant:
    id: str
    name: str
    token: str
    color: int
    joined_at: float
    connected: bool = False
    last_seen: float = field(default_factory=time.monotonic)
    chat_allowance: float = 5.0
    chat_last: float = field(default_factory=time.monotonic)

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "color": self.color, "connected": self.connected}


@dataclass
class Proposal:
    id: str
    type: str            # START | END
    game_id: str
    proposer_id: str
    deadline: float
    votes: dict[str, bool] = field(default_factory=dict)
    timer: Optional[asyncio.TimerHandle] = None


@dataclass
class Room:
    code: str
    host_id: str
    created_at: float = field(default_factory=time.time)
    participants: dict[str, Participant] = field(default_factory=dict)
    proposal: Optional[Proposal] = None
    game: Optional[Game] = None
    game_ctx: Optional["RoomGameContext"] = None
    last_played: Optional[str] = None
    chat: deque = field(default_factory=lambda: deque(maxlen=settings.chat_history_size))
    next_color: int = 0

    def connected_ids(self) -> list[str]:
        return [p.id for p in sorted(self.participants.values(), key=lambda p: p.joined_at) if p.connected]


class RoomGameContext:
    """The bridge a Game uses to talk to its room."""

    def __init__(self, manager: "RoomManager", room: Room):
        self.manager = manager
        self.room = room
        self.dirty = False
        self.disposed = False
        self.finished_sent = False
        self._timers: set[asyncio.TimerHandle] = set()

    def player_ids(self) -> list[str]:
        return self.room.connected_ids()

    def name(self, pid: str) -> str:
        p = self.room.participants.get(pid)
        return p.name if p else "Player"

    def schedule(self, delay: float, fn: Callable[[], None]) -> asyncio.TimerHandle:
        loop = asyncio.get_running_loop()
        handle: asyncio.TimerHandle

        def run() -> None:
            self._timers.discard(handle)
            if self.disposed:
                return
            try:
                fn()
            except Exception:
                log.exception("game timer failed in %s", self.room.code)
            self.flush()

        handle = loop.call_later(delay, run)
        self._timers.add(handle)
        return handle

    def changed(self) -> None:
        self.dirty = True

    def emit(self, type: str, payload: Any = None, *, to: Optional[str] = None,
             exclude: Optional[str] = None) -> None:
        msg = encode({"type": "game_event", "data": {"type": type, "payload": payload}})
        if to:
            self.manager.hub.send(to, msg)
            return
        for pid in self.room.participants:
            if pid != exclude:
                self.manager.hub.send(pid, msg)

    def end(self) -> None:
        # Defer: end() is often called from inside a game callback.
        asyncio.get_running_loop().call_soon(self.manager.end_game, self.room, self)

    def flush(self) -> None:
        if self.dirty and not self.disposed:
            self.dirty = False
            self.manager.push_game_state(self.room)

    def dispose(self) -> None:
        self.disposed = True
        for t in self._timers:
            t.cancel()
        self._timers.clear()


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.sessions: dict[str, tuple[str, str]] = {}   # token -> (room_code, participant_id)
        self.hub = Hub()
        self._gc_task: Optional[asyncio.Task] = None
        self.on_participant_removed: Optional[Callable[[str, str], Any]] = None

    # ------------------------------------------------------------------ membership
    def _new_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(settings.room_code_length))
            if code not in self.rooms:
                return code

    def _add_participant(self, room: Room, name: str) -> Participant:
        p = Participant(
            id=str(uuid.uuid4()),
            name=clean_name(name),
            token=secrets.token_urlsafe(32),
            color=room.next_color % 8,
            joined_at=time.monotonic(),
        )
        room.next_color += 1
        room.participants[p.id] = p
        self.sessions[p.token] = (room.code, p.id)
        if room.game:
            room.game.on_player_joined(p.id)
            room.game_ctx.changed()
        return p

    def create_room(self, name: str) -> tuple[Room, Participant]:
        clean_name(name)
        room = Room(code=self._new_code(), host_id="")
        p = self._add_participant(room, name)
        room.host_id = p.id
        self.rooms[room.code] = room
        log.info("room %s created", room.code)
        return room, p

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get((code or "").upper())

    def join_room(self, code: str, name: str) -> tuple[Room, Participant]:
        room = self.get_room(code)
        if not room:
            raise RoomError(404, "That room doesn't exist or has ended.")
        if len(room.participants) >= settings.max_room_participants:
            raise RoomError(409, "This room is full.")
        p = self._add_participant(room, name)
        self.broadcast_room(room)
        return room, p

    def resume(self, code: str, token: str) -> tuple[Room, Participant]:
        entry = self.sessions.get(token or "")
        if not entry or entry[0] != (code or "").upper():
            raise RoomError(401, "Session expired.")
        room = self.rooms[entry[0]]
        return room, room.participants[entry[1]]

    def leave(self, code: str, token: str) -> None:
        room, p = self.resume(code, token)
        self.remove_participant(room, p.id, reason="left")

    def remove_participant(self, room: Room, pid: str, reason: str) -> None:
        p = room.participants.pop(pid, None)
        if not p:
            return
        self.sessions.pop(p.token, None)
        conn = self.hub.get(pid)
        if conn:
            self.hub.detach(conn)
            asyncio.get_running_loop().create_task(conn.close(CLOSE_KICKED, reason))
        log.info("room %s: %s removed (%s)", room.code, pid[:8], reason)
        if self.on_participant_removed:
            self.on_participant_removed(room.code, pid)

        if not room.participants:
            self._delete_room(room)
            return
        if room.host_id == pid:
            room.host_id = self._pick_host(room)
        if room.game:
            room.game.on_player_left(pid)
            room.game_ctx.flush()
        if room.proposal:
            room.proposal.votes.pop(pid, None)
            self._evaluate_proposal(room)
        self.broadcast_room(room)

    def _pick_host(self, room: Room) -> str:
        ordered = sorted(room.participants.values(), key=lambda p: (not p.connected, p.joined_at))
        return ordered[0].id

    def _delete_room(self, room: Room) -> None:
        if room.proposal and room.proposal.timer:
            room.proposal.timer.cancel()
        if room.game:
            room.game.dispose()
            room.game_ctx.dispose()
        for p in room.participants.values():
            self.sessions.pop(p.token, None)
        self.rooms.pop(room.code, None)
        log.info("room %s deleted", room.code)

    def livekit_token(self, room: Room, p: Participant) -> str:
        return (
            AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(p.id)
            .with_name(p.name)
            .with_ttl(timedelta(hours=settings.livekit_token_ttl_hours))
            .with_grants(VideoGrants(room_join=True, room=room.code, can_publish=True,
                                     can_subscribe=True, can_publish_data=True,
                                     can_update_own_metadata=False))
            .to_jwt()
        )

    # ------------------------------------------------------------------ presence
    def connect(self, conn: Connection) -> None:
        room = self.rooms[conn.room_code]
        p = room.participants[conn.participant_id]
        previous = self.hub.attach(conn)
        if previous:
            asyncio.get_running_loop().create_task(
                previous.close(CLOSE_REPLACED, "Opened in another tab"))
        was_connected = p.connected
        p.connected = True
        p.last_seen = time.monotonic()

        conn.send({"type": "welcome", "data": {"participant_id": p.id}})
        conn.send({"type": "chat_history", "data": {"messages": list(room.chat)}})
        if room.game and not was_connected:
            room.game.on_presence(p.id, True)
            room.game_ctx.changed()
        self.broadcast_room(room)
        if room.game:
            conn.send(self._game_state_message(room, p.id))
            room.game.on_connect(p.id)
            room.game_ctx.flush()

    def disconnect(self, conn: Connection) -> None:
        if not self.hub.detach(conn):
            return  # an old, replaced connection — the participant is still online
        room = self.rooms.get(conn.room_code)
        p = room.participants.get(conn.participant_id) if room else None
        if not p:
            return
        p.connected = False
        p.last_seen = time.monotonic()
        if room.host_id == p.id and any(o.connected for o in room.participants.values()):
            room.host_id = self._pick_host(room)
        if room.game:
            room.game.on_presence(p.id, False)
            room.game_ctx.flush()
        if room.proposal:
            self._evaluate_proposal(room)
        self.broadcast_room(room)

    def sweep(self) -> None:
        """Drop participants who have been gone longer than the grace period."""
        now = time.monotonic()
        for room in list(self.rooms.values()):
            for p in list(room.participants.values()):
                if not p.connected and now - p.last_seen > settings.disconnect_grace_seconds:
                    self.remove_participant(room, p.id, reason="timeout")

    async def run_gc(self) -> None:
        while True:
            await asyncio.sleep(10)
            try:
                self.sweep()
            except Exception:
                log.exception("sweep failed")

    # ------------------------------------------------------------------ snapshots
    def snapshot(self, room: Room) -> dict[str, Any]:
        prop = room.proposal
        return {
            "code": room.code,
            "host_id": room.host_id,
            "participants": [p.public() for p in sorted(room.participants.values(), key=lambda p: p.joined_at)],
            "game": {"id": room.game.id, "name": room.game.name, "finished": room.game.finished} if room.game else None,
            "last_played": room.last_played,
            "proposal": {
                "id": prop.id,
                "type": prop.type,
                "game_id": prop.game_id,
                "game_name": REGISTRY[prop.game_id].name,
                "proposer_id": prop.proposer_id,
                "votes": prop.votes,
                "deadline_ms": max(0, int((prop.deadline - time.monotonic()) * 1000)),
                "rule": self._rule_text(prop.type),
            } if prop else None,
        }

    def broadcast_room(self, room: Room) -> None:
        msg = encode({"type": "room_state", "data": self.snapshot(room)})
        for pid in room.participants:
            self.hub.send(pid, msg)

    def _game_state_message(self, room: Room, pid: str) -> dict[str, Any]:
        return {"type": "game_state", "data": {"game_id": room.game.id, "state": room.game.view(pid)}}

    def push_game_state(self, room: Room) -> None:
        if not room.game:
            return
        for pid in room.participants:
            if self.hub.get(pid):
                self.hub.send(pid, self._game_state_message(room, pid))
        # `finished` lives in the room snapshot too
        if room.game.finished != room.game_ctx.finished_sent:
            room.game_ctx.finished_sent = room.game.finished
            self.broadcast_room(room)

    # ------------------------------------------------------------------ inbound messages
    def handle(self, conn: Connection, message: dict[str, Any]) -> None:
        room = self.rooms.get(conn.room_code)
        p = room.participants.get(conn.participant_id) if room else None
        if not p:
            return
        kind = message.get("type")
        data = message.get("data") or {}
        if not isinstance(data, dict):
            data = {}
        try:
            if kind == "ping":
                conn.send({"type": "pong"})
            elif kind == "chat":
                self._chat(room, p, data.get("text"))
            elif kind == "propose":
                self._propose(room, p, data.get("type", "START"), data.get("game_id"))
            elif kind == "vote":
                self._vote(room, p, data.get("vote"))
            elif kind == "game_action":
                self._game_action(room, p, data.get("action"), data.get("payload") or {})
            elif kind == "kick":
                self._kick(room, p, data.get("participant_id"))
            else:
                raise ActionError(f"Unknown message type {kind!r}")
        except ActionError as e:
            conn.send({"type": "error", "data": {"message": str(e)}})

    def _chat(self, room: Room, p: Participant, text: Any) -> None:
        if not isinstance(text, str) or not text.strip():
            return
        now = time.monotonic()
        p.chat_allowance = min(5.0, p.chat_allowance + (now - p.chat_last) * 1.0)
        p.chat_last = now
        if p.chat_allowance < 1:
            raise ActionError("You're sending messages too fast.")
        p.chat_allowance -= 1
        msg = {"id": uuid.uuid4().hex[:12], "sender_id": p.id, "sender_name": p.name,
               "text": text.strip()[:500], "ts": int(time.time() * 1000)}
        room.chat.append(msg)
        encoded = encode({"type": "chat", "data": msg})
        for pid in room.participants:
            self.hub.send(pid, encoded)

    def _kick(self, room: Room, p: Participant, target: Any) -> None:
        if p.id != room.host_id:
            raise ActionError("Only the host can remove people.")
        if target == p.id or target not in room.participants:
            raise ActionError("Can't remove that participant.")
        self.remove_participant(room, target, reason="removed by host")

    # ------------------------------------------------------------------ games
    def _game_action(self, room: Room, p: Participant, action: Any, payload: Any) -> None:
        if not room.game:
            raise ActionError("No game is running.")
        if not isinstance(action, str) or not isinstance(payload, dict):
            raise ActionError("Malformed action.")
        if action == "return_to_lobby":
            if not room.game.finished:
                raise ActionError("The game is still going — propose ending it instead.")
            self.end_game(room, room.game_ctx)
            return
        room.game.on_action(p.id, action, payload)
        room.game_ctx.flush()

    def start_game(self, room: Room, game_id: str) -> None:
        cls = REGISTRY[game_id]
        ctx = RoomGameContext(self, room)
        room.game_ctx = ctx
        room.game = cls(ctx)
        room.game.start()
        ctx.changed()
        ctx.flush()
        log.info("room %s: started %s", room.code, game_id)

    def end_game(self, room: Room, ctx: Optional[RoomGameContext] = None) -> None:
        if not room.game or (ctx is not None and room.game_ctx is not ctx):
            return  # already ended / a newer game is running
        room.last_played = room.game.id
        room.game.dispose()
        room.game_ctx.dispose()
        room.game = None
        room.game_ctx = None
        msg = encode({"type": "game_state", "data": None})
        for pid in room.participants:
            self.hub.send(pid, msg)
        self.broadcast_room(room)

    # ------------------------------------------------------------------ voting
    @staticmethod
    def _needed(kind: str, n: int) -> int:
        # START needs a strict majority; END needs half (one of two players can end).
        return n // 2 + 1 if kind == "START" else max(1, math.ceil(n / 2))

    @staticmethod
    def _rule_text(kind: str) -> str:
        return "Starts with a majority" if kind == "START" else "Ends when half the room agrees"

    def _propose(self, room: Room, p: Participant, kind: Any, game_id: Any) -> None:
        if room.proposal:
            raise ActionError("There's already a vote in progress.")
        if kind == "START":
            if room.game:
                raise ActionError("A game is already running.")
            if game_id not in REGISTRY:
                raise ActionError("Unknown game.")
            cls = REGISTRY[game_id]
            if len(room.connected_ids()) < cls.min_players:
                raise ActionError(f"{cls.name} needs at least {cls.min_players} players.")
        elif kind == "END":
            if not room.game:
                raise ActionError("No game is running.")
            if room.game.finished:
                self.end_game(room)
                return
            game_id = room.game.id
        else:
            raise ActionError("Unknown proposal type.")

        prop = Proposal(id=uuid.uuid4().hex[:8], type=kind, game_id=game_id, proposer_id=p.id,
                        deadline=time.monotonic() + settings.proposal_seconds, votes={p.id: True})
        room.proposal = prop
        prop.timer = asyncio.get_running_loop().call_later(
            settings.proposal_seconds, self._proposal_timeout, room.code, prop.id)
        if not self._evaluate_proposal(room):
            self.broadcast_room(room)

    def _vote(self, room: Room, p: Participant, vote: Any) -> None:
        if not room.proposal:
            raise ActionError("Nothing to vote on.")
        if not isinstance(vote, bool):
            raise ActionError("Vote must be yes or no.")
        room.proposal.votes[p.id] = vote
        if not self._evaluate_proposal(room):
            self.broadcast_room(room)

    def _proposal_timeout(self, code: str, proposal_id: str) -> None:
        room = self.rooms.get(code)
        if room and room.proposal and room.proposal.id == proposal_id:
            self._evaluate_proposal(room, final=True)

    def _evaluate_proposal(self, room: Room, final: bool = False) -> bool:
        """Resolve the proposal if the outcome is decided. Returns True if resolved."""
        prop = room.proposal
        if not prop:
            return False
        eligible = set(room.connected_ids()) | {prop.proposer_id}
        eligible &= set(room.participants)
        n = len(eligible)
        yes = sum(1 for pid in eligible if prop.votes.get(pid) is True)
        no = sum(1 for pid in eligible if prop.votes.get(pid) is False)
        need = self._needed(prop.type, n)

        if yes >= need:
            passed = True
        elif yes + (n - yes - no) < need:   # can no longer reach the bar
            passed = False
        elif final:
            passed = yes > no                # non-voters abstain
        else:
            return False

        if prop.timer:
            prop.timer.cancel()
        room.proposal = None
        self._notify(room, "proposal_result",
                     {"type": prop.type, "game_id": prop.game_id, "passed": passed})
        if passed and prop.type == "START":
            if len(room.connected_ids()) >= REGISTRY[prop.game_id].min_players and not room.game:
                self.start_game(room, prop.game_id)
        elif passed and prop.type == "END":
            self.end_game(room)
        self.broadcast_room(room)
        return True

    def _notify(self, room: Room, kind: str, data: dict[str, Any]) -> None:
        msg = encode({"type": kind, "data": data})
        for pid in room.participants:
            self.hub.send(pid, msg)


manager = RoomManager()
