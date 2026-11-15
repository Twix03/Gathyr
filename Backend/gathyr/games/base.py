"""Server-authoritative game engine.

A Game never touches sockets. It mutates its own state in response to player
actions and timers, calls `ctx.changed()`, and the room pushes each player a
personalised `view()` afterwards. Transient things (drawing strokes, "close!"
hints) go through `ctx.emit()`.

Deadlines are sent as *remaining milliseconds* so client clock skew never matters.
"""
from __future__ import annotations

import time
from typing import Any, Callable, ClassVar, Optional, Protocol


class TimerHandle(Protocol):
    def cancel(self) -> None: ...


class GameContext(Protocol):
    def player_ids(self) -> list[str]:
        """Participants currently connected, in join order."""

    def name(self, participant_id: str) -> str: ...

    def schedule(self, delay: float, fn: Callable[[], None]) -> TimerHandle:
        """Run fn after delay seconds; state is flushed to clients afterwards."""

    def changed(self) -> None:
        """Mark state dirty so every player gets a fresh view."""

    def emit(self, type: str, payload: Any = None, *, to: Optional[str] = None,
             exclude: Optional[str] = None) -> None: ...

    def end(self) -> None:
        """Return the room to the lobby."""


class ActionError(Exception):
    """Invalid action — reported to the sender only."""


class Game:
    id: ClassVar[str]
    name: ClassVar[str]
    min_players: ClassVar[int] = 1
    # Seconds the results screen stays up before returning to the lobby.
    RESULTS_SECONDS: ClassVar[float] = 45

    def __init__(self, ctx: GameContext):
        self.ctx = ctx
        self.phase = "STARTING"
        self.finished = False
        self.scores: dict[str, int] = {pid: 0 for pid in ctx.player_ids()}
        self._names: dict[str, str] = {pid: ctx.name(pid) for pid in ctx.player_ids()}
        self._deadline: Optional[float] = None
        self._timer: Optional[TimerHandle] = None

    # ---- lifecycle hooks (override) -------------------------------------------------
    def start(self) -> None:
        raise NotImplementedError

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        raise ActionError(f"Unknown action {action!r}")

    def on_player_joined(self, pid: str) -> None:
        """A new participant joined the room mid-game."""
        self.scores.setdefault(pid, 0)
        self._names[pid] = self.ctx.name(pid)

    def on_player_left(self, pid: str) -> None:
        """A participant left the room for good (not a brief disconnect)."""

    def on_presence(self, pid: str, connected: bool) -> None:
        """A participant connected or disconnected (may come back)."""

    def on_connect(self, pid: str) -> None:
        """A participant (re)connected and just received their view — send extra sync."""

    def view(self, pid: str) -> dict[str, Any]:
        raise NotImplementedError

    # ---- helpers --------------------------------------------------------------------
    def set_phase(self, phase: str, seconds: Optional[float] = None,
                  then: Optional[Callable[[], None]] = None) -> None:
        self.cancel_timer()
        self.phase = phase
        if seconds is not None and then is not None:
            self._deadline = time.monotonic() + seconds
            self._timer = self.ctx.schedule(seconds, then)
        self.ctx.changed()

    def cancel_timer(self) -> None:
        if self._timer:
            self._timer.cancel()
        self._timer = None
        self._deadline = None

    def remaining_ms(self) -> Optional[int]:
        if self._deadline is None:
            return None
        return max(0, int((self._deadline - time.monotonic()) * 1000))

    def add_points(self, pid: str, points: int) -> None:
        self.scores[pid] = self.scores.get(pid, 0) + points

    def player_name(self, pid: str) -> str:
        return self._names.get(pid) or self.ctx.name(pid)

    def leaderboard(self) -> list[dict[str, Any]]:
        rows = [{"id": pid, "name": self.player_name(pid), "score": s} for pid, s in self.scores.items()]
        rows.sort(key=lambda r: -r["score"])
        return rows

    def finish(self) -> None:
        self.finished = True
        self.set_phase("FINISHED", self.RESULTS_SECONDS, self.ctx.end)

    def dispose(self) -> None:
        self.cancel_timer()

    def base_view(self) -> dict[str, Any]:
        return {
            "phase": self.phase,
            "deadline_ms": self.remaining_ms(),
            "scores": self.scores,
            "finished": self.finished,
            "leaderboard": self.leaderboard() if self.finished else None,
        }
