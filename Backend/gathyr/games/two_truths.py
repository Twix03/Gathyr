"""Two Truths and a Lie: everyone writes three statements, then the group hunts each lie."""
from __future__ import annotations

import random
from typing import Any, Optional

from . import register
from .base import ActionError, Game


@register
class TwoTruths(Game):
    id = "two-truths"
    name = "Two Truths & a Lie"
    min_players = 2

    WRITE_SECONDS = 120
    VOTE_SECONDS = 25
    REVEAL_SECONDS = 7

    def start(self) -> None:
        self.entries: dict[str, dict[str, Any]] = {}   # pid -> {statements, lie}
        self.queue: list[str] = []
        self.author: Optional[str] = None
        self.votes: dict[str, int] = {}
        self.round_points: dict[str, int] = {}
        self.set_phase("WRITE", self.WRITE_SECONDS, self._begin_voting)

    def _begin_voting(self) -> None:
        if self.phase != "WRITE":
            return
        self.queue = [p for p in self.entries]
        random.shuffle(self.queue)
        self._next_author()

    def _next_author(self) -> None:
        online = set(self.ctx.player_ids())
        while self.queue:
            candidate = self.queue.pop(0)
            if candidate in self.entries and (online - {candidate}):
                self.author = candidate
                self.votes = {}
                self.round_points = {}
                self.set_phase("VOTE", self.VOTE_SECONDS, self._reveal)
                return
        self.finish()

    def _reveal(self) -> None:
        if self.phase != "VOTE" or not self.author:
            return
        lie = self.entries[self.author]["lie"]
        fooled = 0
        for pid, choice in self.votes.items():
            if choice == lie:
                self.round_points[pid] = 100
                self.add_points(pid, 100)
            else:
                fooled += 1
        if fooled:
            self.round_points[self.author] = 50 * fooled
            self.add_points(self.author, 50 * fooled)
        self.set_phase("REVEAL", self.REVEAL_SECONDS, self._next_author)

    def _voters(self) -> list[str]:
        return [p for p in self.ctx.player_ids() if p != self.author]

    def _check_all_in(self) -> None:
        if self.phase == "WRITE":
            online = self.ctx.player_ids()
            if online and all(p in self.entries for p in online):
                self._begin_voting()
        elif self.phase == "VOTE":
            voters = self._voters()
            if voters and all(p in self.votes for p in voters):
                self._reveal()

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action == "submit":
            if self.phase != "WRITE":
                raise ActionError("Writing time is over.")
            statements = payload.get("statements")
            lie = payload.get("lie")
            if (not isinstance(statements, list) or len(statements) != 3
                    or not all(isinstance(s, str) and 1 <= len(s.strip()) <= 140 for s in statements)):
                raise ActionError("Write three statements (up to 140 characters each).")
            if lie not in (0, 1, 2):
                raise ActionError("Mark which one is the lie.")
            self.entries[pid] = {"statements": [s.strip() for s in statements], "lie": lie}
            self.ctx.changed()
            self._check_all_in()
        elif action == "vote":
            if self.phase != "VOTE" or pid == self.author:
                return
            choice = payload.get("index")
            if choice not in (0, 1, 2):
                raise ActionError("Pick one of the three.")
            self.votes[pid] = choice
            self.ctx.changed()
            self._check_all_in()
        else:
            raise ActionError("Unknown action.")

    def on_presence(self, pid: str, connected: bool) -> None:
        if not connected:
            self._check_all_in()

    def on_player_left(self, pid: str) -> None:
        if self.phase in ("VOTE", "REVEAL") and pid == self.author:
            self._next_author()
        else:
            self._check_all_in()

    def view(self, pid: str) -> dict[str, Any]:
        entry = self.entries.get(self.author) if self.author else None
        revealing = self.phase == "REVEAL"
        tally = [0, 0, 0]
        for choice in self.votes.values():
            tally[choice] += 1
        return {
            **self.base_view(),
            "submitted": list(self.entries),
            "my_entry": self.entries.get(pid),
            "author": self.author if self.phase in ("VOTE", "REVEAL") else None,
            "statements": entry["statements"] if entry and self.phase in ("VOTE", "REVEAL") else None,
            "my_vote": self.votes.get(pid),
            "voted": list(self.votes),
            "lie": entry["lie"] if entry and revealing else None,
            "tally": tally if revealing else None,
            "round_points": self.round_points if revealing else None,
            "remaining_authors": len(self.queue),
            "total_seconds": {"WRITE": self.WRITE_SECONDS, "VOTE": self.VOTE_SECONDS,
                              "REVEAL": self.REVEAL_SECONDS}.get(self.phase),
        }
