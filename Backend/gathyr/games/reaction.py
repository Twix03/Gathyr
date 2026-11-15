"""Quick Draw: wait for green, then tap.

The reaction time is measured on the player's own device (from the moment green is
shown to the tap), so network latency doesn't decide who wins. The server clamps
reported times to what it observed, so nobody can claim to be faster than physically
possible from the server's point of view.
"""
from __future__ import annotations

import random
import time
from typing import Any, Optional

from . import register
from .base import ActionError, Game

MIN_HUMAN_MS = 100   # faster than this is a guess, not a reaction


@register
class Reaction(Game):
    id = "reaction"
    name = "Quick Draw"
    min_players = 1

    ROUNDS = 5
    GO_SECONDS = 3
    RESULT_SECONDS = 3.5

    def start(self) -> None:
        self.round = 0
        self.times: dict[str, Optional[int]] = {}   # pid -> ms, None = false start
        self.best: dict[str, int] = {}
        self.go_at = 0.0
        self._next_round()

    def _next_round(self) -> None:
        self.round += 1
        if self.round > self.ROUNDS:
            self.finish()
            return
        self.times = {}
        self.set_phase("WAIT", random.uniform(2.0, 5.0), self._go)

    def _go(self) -> None:
        self.go_at = time.monotonic()
        self.set_phase("GO", self.GO_SECONDS, self._results)

    def _results(self) -> None:
        if self.phase != "GO":
            return
        valid = sorted((ms, pid) for pid, ms in self.times.items() if ms is not None)
        for rank, (ms, pid) in enumerate(valid):
            self.add_points(pid, max(20, 100 - rank * 25))
            self.best[pid] = min(ms, self.best.get(pid, ms))
        self.set_phase("RESULT", self.RESULT_SECONDS, self._next_round)

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action != "tap":
            raise ActionError("Unknown action.")
        if pid in self.times:
            return
        if self.phase == "WAIT":
            self.times[pid] = None   # jumped the gun
            self.add_points(pid, -25)
            self.ctx.changed()
        elif self.phase == "GO":
            server_ms = int((time.monotonic() - self.go_at) * 1000)
            client_ms = payload.get("ms")
            ms = int(client_ms) if isinstance(client_ms, (int, float)) and 0 < client_ms <= server_ms + 50 else server_ms
            self.times[pid] = None if ms < MIN_HUMAN_MS else ms
            self.ctx.changed()
            online = self.ctx.player_ids()
            if all(p in self.times for p in online):
                self._results()

    def on_presence(self, pid: str, connected: bool) -> None:
        if not connected and self.phase == "GO" and all(p in self.times for p in self.ctx.player_ids()):
            self._results()

    def view(self, pid: str) -> dict[str, Any]:
        mine = self.times.get(pid, "pending")
        base = self.base_view()
        if self.phase == "WAIT":
            base["deadline_ms"] = None   # never reveal when green is coming
        return {
            **base,
            "round": self.round,
            "rounds": self.ROUNDS,
            "my_time": mine if mine != "pending" else None,
            "tapped": pid in self.times,
            "false_start": pid in self.times and self.times[pid] is None,
            "results": [{"id": p, "ms": ms} for p, ms in sorted(
                self.times.items(), key=lambda kv: (kv[1] is None, kv[1] or 0))] if self.phase == "RESULT" else None,
            "best": self.best,
        }
