"""Game registry: id -> Game class."""
from __future__ import annotations

from .base import Game

REGISTRY: dict[str, type[Game]] = {}


def register(cls: type[Game]) -> type[Game]:
    REGISTRY[cls.id] = cls
    return cls
