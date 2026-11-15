"""Scribble: one player draws, the others guess."""
from __future__ import annotations

import random
import re
import time
from typing import Any, Optional

from . import register
from .base import ActionError, Game

WORDS = sorted({w.strip() for w in """
apple, banana, carrot, pizza, burger, donut, cookie, cupcake, sandwich, popcorn, pineapple, watermelon,
cherry, lemon, broccoli, mushroom, avocado, pretzel, taco, sushi, pancake, cheese, egg, bread, hot dog,
ice cream cone, cat, dog, rabbit, horse, cow, pig, sheep, chicken, duck, owl, penguin, elephant, giraffe,
lion, tiger, zebra, monkey, kangaroo, koala, panda, bear, fox, wolf, snake, turtle, frog, octopus,
jellyfish, shark, whale, dolphin, crab, snail, butterfly, spider, bee, ant, ladybug, dinosaur, unicorn,
dragon, bat, squirrel, hedgehog, camel, flamingo, parrot, house, castle, tent, igloo, lighthouse, bridge,
tower, barn, windmill, skyscraper, pyramid, volcano, island, mountain, river, waterfall, beach, desert,
forest, cave, rainbow, cloud, lightning, tornado, snowman, moon, sun, star, planet, rocket, airplane,
helicopter, car, bus, train, bicycle, motorcycle, boat, submarine, tractor, skateboard, fire truck,
roller coaster, umbrella, glasses, hat, crown, shoe, sock, backpack, wallet, key, lock, clock, watch,
phone, laptop, camera, television, guitar, piano, drum, trumpet, violin, microphone, headphones, lamp,
candle, chair, table, bed, sofa, door, window, ladder, hammer, scissors, toothbrush, comb, mirror,
bathtub, toilet, bucket, broom, fridge, oven, kettle, balloon, kite, present, ticket, trophy, medal,
anchor, compass, map, flag, treasure, pirate, ghost, robot, alien, vampire, mermaid, wizard, ninja,
astronaut, clown, king, queen, knight, cowboy, firefighter, doctor, chef, basketball, football, tennis,
bowling, golf, surfing, skiing, fishing, camping, swimming, dancing, sleeping, snowflake, leaf, flower,
tree, palm tree, cactus, seashell, feather, bone, skull, heart, diamond, magnet, battery, lightbulb,
fire, ice cube, bandage, envelope, pencil, crayon, paintbrush, book, newspaper, calendar, paperclip,
globe, telescope, microscope, sunflower, spider web, traffic light, snail, mailbox, parachute, swing
""".split(",") if w.strip()})

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_POINTS_PER_SEGMENT = 400
MAX_TOTAL_POINTS = 60_000


def normalize(text: str) -> str:
    return re.sub(r"[^a-z]", "", text.lower())


def one_edit_apart(a: str, b: str) -> bool:
    if abs(len(a) - len(b)) > 1 or a == b:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) == 1
    if len(a) > len(b):
        a, b = b, a
    i = j = 0
    skipped = False
    while i < len(a) and j < len(b):
        if a[i] != b[j]:
            if skipped:
                return False
            skipped = True
            j += 1
        else:
            i += 1
            j += 1
    return True


@register
class Scribble(Game):
    id = "scribble"
    name = "Scribble"
    min_players = 2

    ROUNDS = 2
    CHOOSE_SECONDS = 12
    DRAW_SECONDS = 80
    REVEAL_SECONDS = 6

    def start(self) -> None:
        self.order: list[str] = list(self.ctx.player_ids())
        random.shuffle(self.order)
        self.round = 1
        self.turn_index = -1
        self.turn_id = 0
        self.drawer: Optional[str] = None
        self.word: Optional[str] = None
        self.choices: list[str] = []
        self.revealed: set[int] = set()
        self.guessed: dict[str, int] = {}     # pid -> points earned this turn
        self.drawer_points = 0
        self.draw_started = 0.0
        self.strokes: list[dict[str, Any]] = []
        self.total_points = 0
        self.used_words: set[str] = set()
        self._next_turn()

    # ------------------------------------------------------------------ turn flow
    def _next_turn(self) -> None:
        online = set(self.ctx.player_ids())
        if len(online) < 2:
            self.finish()
            return
        for _ in range(len(self.order) * 2 + 2):
            self.turn_index += 1
            if self.turn_index >= len(self.order):
                self.turn_index = 0
                self.round += 1
            if self.round > self.ROUNDS:
                self.finish()
                return
            if self.order[self.turn_index] in online:
                break
        else:
            self.finish()
            return

        self.turn_id += 1
        self.drawer = self.order[self.turn_index]
        pool = [w for w in WORDS if w not in self.used_words] or WORDS
        self.choices = random.sample(pool, 3)
        self.word = None
        self.revealed = set()
        self.guessed = {}
        self.drawer_points = 0
        self._clear_canvas()
        self.set_phase("CHOOSING", self.CHOOSE_SECONDS, lambda: self._choose(random.randrange(3)))

    def _choose(self, index: int) -> None:
        if self.phase != "CHOOSING":
            return
        self.word = self.choices[index]
        self.used_words.add(self.word)
        self.draw_started = time.monotonic()
        turn = self.turn_id
        letters = [i for i, c in enumerate(self.word) if c.isalpha()]
        random.shuffle(letters)
        hints = min(len(letters) - 2, 2) if len(letters) > 3 else 0
        for n in range(hints):
            frac = 0.5 + 0.25 * n
            pos = letters[n]
            self.ctx.schedule(self.DRAW_SECONDS * frac, lambda pos=pos: self._hint(turn, pos))
        self.set_phase("DRAWING", self.DRAW_SECONDS, self._end_turn)

    def _hint(self, turn: int, pos: int) -> None:
        if turn == self.turn_id and self.phase == "DRAWING":
            self.revealed.add(pos)
            self.ctx.changed()

    def _end_turn(self) -> None:
        if self.phase not in ("CHOOSING", "DRAWING"):
            return
        if self.word is None and self.choices:
            self.word = self.choices[0]
        self.set_phase("REVEAL", self.REVEAL_SECONDS, self._next_turn)

    # ------------------------------------------------------------------ canvas
    def _clear_canvas(self) -> None:
        self.strokes = []
        self.total_points = 0
        self.ctx.emit("canvas", {"strokes": []})

    def _stroke(self, payload: dict[str, Any]) -> None:
        pts = payload.get("p")
        sid = payload.get("s")
        color = payload.get("c")
        width = payload.get("w")
        if (not isinstance(pts, list) or not 2 <= len(pts) <= MAX_POINTS_PER_SEGMENT * 2 or len(pts) % 2
                or not isinstance(sid, int) or not isinstance(color, str) or not COLOR_RE.match(color)
                or not isinstance(width, (int, float)) or not 1 <= width <= 60):
            raise ActionError("Bad stroke.")
        clean: list[float] = []
        for v in pts:
            if not isinstance(v, (int, float)):
                raise ActionError("Bad stroke.")
            clean.append(round(min(1.0, max(0.0, float(v))), 4))
        if self.total_points + len(clean) // 2 > MAX_TOTAL_POINTS:
            return  # canvas full — silently ignore further ink
        seg = {"s": sid, "c": color, "w": width, "p": clean}
        self.strokes.append(seg)
        self.total_points += len(clean) // 2
        self.ctx.emit("stroke", seg, exclude=self.drawer)

    def _undo(self) -> None:
        if not self.strokes:
            return
        last = self.strokes[-1]["s"]
        self.strokes = [s for s in self.strokes if s["s"] != last]
        self.total_points = sum(len(s["p"]) // 2 for s in self.strokes)
        self.ctx.emit("canvas", {"strokes": self.strokes})

    # ------------------------------------------------------------------ actions
    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action == "choose":
            if pid != self.drawer or self.phase != "CHOOSING":
                raise ActionError("Not your turn to choose.")
            idx = payload.get("index")
            if idx not in (0, 1, 2):
                raise ActionError("Pick one of the three words.")
            self._choose(idx)
        elif action in ("stroke", "undo", "clear"):
            if pid != self.drawer or self.phase != "DRAWING":
                return  # late packets after the turn ended are harmless
            if action == "stroke":
                self._stroke(payload)
            elif action == "undo":
                self._undo()
            else:
                self._clear_canvas()
        elif action == "guess":
            self._guess(pid, payload.get("text"))
        elif action == "sync":
            self.on_connect(pid)
        else:
            raise ActionError("Unknown action.")

    def _guess(self, pid: str, text: Any) -> None:
        if not isinstance(text, str) or not text.strip():
            return
        text = text.strip()[:60]
        if self.phase != "DRAWING" or pid == self.drawer or pid in self.guessed:
            # chat-style message (e.g. from the drawer or someone who already got it)
            # is only shown to people who can't be spoiled by it
            if self.phase == "DRAWING" and self.word and normalize(text) == normalize(self.word):
                return
            audience = [p for p in self.scores if p == self.drawer or p in self.guessed] if self.phase == "DRAWING" else None
            if audience is None:
                self.ctx.emit("guess", {"pid": pid, "text": text})
            else:
                for p in audience:
                    self.ctx.emit("guess", {"pid": pid, "text": text, "private": True}, to=p)
            return

        assert self.word is not None
        if normalize(text) == normalize(self.word):
            elapsed = time.monotonic() - self.draw_started
            ratio = max(0.0, 1 - elapsed / self.DRAW_SECONDS)
            order_bonus = max(0, 50 - 15 * len(self.guessed))
            points = 100 + int(150 * ratio) + order_bonus
            self.guessed[pid] = points
            self.add_points(pid, points)
            self.add_points(self.drawer, 40)
            self.drawer_points += 40
            self.ctx.emit("guess", {"pid": pid, "correct": True})
            self.ctx.changed()
            if self._everyone_guessed():
                self._end_turn()
            return
        if one_edit_apart(normalize(text), normalize(self.word)):
            # near miss: tell only the guesser, so nobody else gets a free hint
            self.ctx.emit("guess", {"pid": pid, "text": text, "close": True}, to=pid)
            return
        self.ctx.emit("guess", {"pid": pid, "text": text})

    def _everyone_guessed(self) -> bool:
        guessers = [p for p in self.ctx.player_ids() if p != self.drawer]
        return bool(guessers) and all(p in self.guessed for p in guessers)

    # ------------------------------------------------------------------ presence
    def on_player_joined(self, pid: str) -> None:
        super().on_player_joined(pid)
        if pid not in self.order:
            self.order.append(pid)

    def on_player_left(self, pid: str) -> None:
        if len(self.ctx.player_ids()) < 2:
            self.finish()
        elif pid == self.drawer and self.phase in ("CHOOSING", "DRAWING"):
            self._end_turn()
        elif self.phase == "DRAWING" and self._everyone_guessed():
            self._end_turn()

    def on_presence(self, pid: str, connected: bool) -> None:
        if not connected and self.phase == "DRAWING" and self._everyone_guessed():
            self._end_turn()

    def on_connect(self, pid: str) -> None:
        self.ctx.emit("canvas", {"strokes": self.strokes}, to=pid)

    # ------------------------------------------------------------------ view
    def _mask(self) -> str:
        if not self.word:
            return ""
        return "".join(c if (not c.isalpha() or i in self.revealed) else "_" for i, c in enumerate(self.word))

    def view(self, pid: str) -> dict[str, Any]:
        can_see = self.phase == "REVEAL" or pid == self.drawer or pid in self.guessed
        return {
            **self.base_view(),
            "round": min(self.round, self.ROUNDS),
            "rounds": self.ROUNDS,
            "drawer": self.drawer,
            "choices": self.choices if pid == self.drawer and self.phase == "CHOOSING" else None,
            "word": self.word if can_see else None,
            "mask": self._mask(),
            "guessed": list(self.guessed),
            "turn_points": {**self.guessed, **({self.drawer: self.drawer_points} if self.drawer else {})}
            if self.phase == "REVEAL" else None,
            "total_seconds": {"CHOOSING": self.CHOOSE_SECONDS, "DRAWING": self.DRAW_SECONDS,
                              "REVEAL": self.REVEAL_SECONDS}.get(self.phase),
        }
