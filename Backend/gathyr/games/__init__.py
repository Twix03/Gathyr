"""Game registry: id -> Game class."""
from __future__ import annotations

from .base import Game

REGISTRY: dict[str, type[Game]] = {}


def register(cls: type[Game]) -> type[Game]:
    REGISTRY[cls.id] = cls
    return cls


# Import game modules so they register themselves (must come after `register`).
from . import reaction, scribble, trivia, truth_or_dare, two_truths, wordchain  # noqa: E402,F401
