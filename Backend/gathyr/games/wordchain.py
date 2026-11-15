"""Word Chain: each word must start with the last letter of the previous one."""
from __future__ import annotations

import gzip
import random
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from . import register
from .base import ActionError, Game

WORD_RE = re.compile(r"^[a-z]{3,20}$")
STARTERS = ["apple", "garden", "music", "ocean", "rocket", "planet", "pizza", "window", "tiger", "candle",
            "forest", "dragon", "river", "silver", "honey", "jungle", "kitten", "lemon", "mirror", "puzzle"]


@lru_cache(maxsize=1)
def dictionary() -> frozenset[str]:
    path = Path(__file__).parent / "data" / "words.txt.gz"
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return frozenset(line.strip() for line in f if line.strip())


def is_word(word: str) -> bool:
    """Lenient dictionary check: the base list has no plurals/inflections."""
    words = dictionary()
    if word in words:
        return True
    stems = []
    for suffix, repl in (("ies", "y"), ("ied", "y"), ("es", ""), ("s", ""), ("ed", ""), ("ed", "e"), ("d", ""),
                         ("ing", ""), ("ing", "e"), ("er", ""), ("er", "e"), ("ers", ""), ("est", ""), ("ly", "")):
        if word.endswith(suffix) and len(word) - len(suffix) >= 2:
            stems.append(word[: -len(suffix)] + repl)
    # doubled consonant: running -> run, stopped -> stop
    for s in list(stems):
        if len(s) >= 3 and s[-1] == s[-2]:
            stems.append(s[:-1])
    return any(s in words for s in stems)


@register
class WordChain(Game):
    id = "wordchain"
    name = "Word Chain"
    min_players = 2

    LIVES = 2
    START_SECONDS = 20
    MIN_SECONDS = 8
    MAX_WORDS = 80

    def start(self) -> None:
        self.order = list(self.ctx.player_ids())
        random.shuffle(self.order)
        self.lives = {pid: self.LIVES for pid in self.order}
        starter = random.choice(STARTERS)
        self.chain: list[dict[str, Any]] = [{"word": starter, "pid": None}]
        self.used = {starter}
        self.turn = -1
        self.current: Optional[str] = None
        self.last_event: Optional[dict[str, Any]] = None
        self._advance()

    def _alive(self) -> list[str]:
        online = set(self.ctx.player_ids())
        return [p for p in self.order if self.lives.get(p, 0) > 0 and p in online]

    def _turn_seconds(self) -> float:
        return max(self.MIN_SECONDS, self.START_SECONDS - (len(self.chain) - 1) * 0.5)

    def _advance(self) -> None:
        alive = self._alive()
        if len(alive) <= 1 or len(self.chain) > self.MAX_WORDS:
            for p in alive:
                self.add_points(p, 50)   # last one standing / survived the marathon
            self.finish()
            return
        for _ in range(len(self.order)):
            self.turn = (self.turn + 1) % len(self.order)
            if self.order[self.turn] in alive:
                break
        self.current = self.order[self.turn]
        self.set_phase("TURN", self._turn_seconds(), self._timeout)

    def _timeout(self) -> None:
        if self.phase != "TURN" or not self.current:
            return
        pid = self.current
        self.lives[pid] = self.lives.get(pid, 0) - 1
        self.last_event = {"type": "timeout", "pid": pid, "out": self.lives[pid] <= 0}
        self._advance()

    @property
    def letter(self) -> str:
        return self.chain[-1]["word"][-1]

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action != "word":
            raise ActionError("Unknown action.")
        if self.phase != "TURN" or pid != self.current:
            raise ActionError("It's not your turn.")
        raw = payload.get("word")
        word = raw.strip().lower() if isinstance(raw, str) else ""
        if not WORD_RE.match(word):
            raise ActionError("Letters only, at least 3 of them.")
        if word[0] != self.letter:
            raise ActionError(f"Your word has to start with “{self.letter.upper()}”.")
        if word in self.used:
            raise ActionError(f"“{word}” was already used.")
        if not is_word(word):
            raise ActionError(f"“{word}” isn't in our dictionary.")
        self.used.add(word)
        self.chain.append({"word": word, "pid": pid})
        self.add_points(pid, 10 + max(0, len(word) - 3) * 3)
        self.last_event = {"type": "word", "pid": pid, "word": word}
        self._advance()

    def on_player_joined(self, pid: str) -> None:
        super().on_player_joined(pid)
        if pid not in self.order:
            self.order.append(pid)
            self.lives[pid] = self.LIVES

    def on_player_left(self, pid: str) -> None:
        self.lives[pid] = 0
        if pid == self.current or len(self._alive()) <= 1:
            self._advance()

    def on_presence(self, pid: str, connected: bool) -> None:
        if not connected and len(self._alive()) <= 1:
            self._advance()

    def view(self, pid: str) -> dict[str, Any]:
        return {
            **self.base_view(),
            "chain": self.chain[-40:],
            "letter": self.letter,
            "current": self.current,
            "order": self.order,
            "lives": self.lives,
            "max_lives": self.LIVES,
            "last_event": self.last_event,
            "total_seconds": self._turn_seconds(),
        }
