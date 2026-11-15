"""Truth or Dare, built for video calls: dares are things you can do on camera."""
from __future__ import annotations

import random
from typing import Any, Optional

from . import register
from .base import ActionError, Game

TRUTHS = [
    "What's the most embarrassing thing in your search history this week?",
    "What's a hill you would happily die on?",
    "Who in this call would survive longest in a zombie apocalypse, and why?",
    "What's the worst gift you've ever received?",
    "What's a habit you'd never admit to a new date?",
    "What's the pettiest reason you've stopped talking to someone?",
    "What's your most-used emoji, and what does it say about you?",
    "What's the last lie you told?",
    "What's a song you secretly know every word to?",
    "If you had to delete every app but three, which three stay?",
    "What's the most childish thing you still do?",
    "What's your weirdest food combination that you genuinely enjoy?",
    "What's one thing you'd change about yourself if you could?",
    "Who was your first celebrity crush?",
    "What's the most trouble you've ever been in?",
    "What's a skill you pretend to have?",
    "What's the longest you've gone without showering?",
    "What's something you've done that you hope nobody here ever finds out about?",
    "Which person in this call do you text the most?",
    "What's the worst haircut you've ever had?",
    "If your life were a movie, what would the title be?",
    "What's a red flag you've ignored?",
    "What's the most money you've wasted on something useless?",
    "What's a conspiracy theory you half-believe?",
    "What do you think people get wrong about you?",
    "What's the strangest dream you remember?",
    "What's the most awkward thing that happened to you on a video call?",
    "Which fictional character would you swap lives with for a week?",
    "What's the best compliment you've ever received?",
    "What was your most embarrassing phase growing up?",
    "What's a rule you break all the time?",
    "What would you do with a million dollars, honestly?",
    "What's your guilty-pleasure TV show?",
    "What's something you're irrationally scared of?",
    "Who here would you call if you needed to hide a body (hypothetically)?",
]

DARES = [
    "Do your best impression of someone in this call until someone guesses who it is.",
    "Show the last photo in your camera roll (or describe it in detail).",
    "Speak in an accent for the next three rounds.",
    "Do ten jumping jacks on camera.",
    "Sing the chorus of the last song you listened to.",
    "Hold a plank for 30 seconds while answering questions from the group.",
    "Show everyone the most interesting object within arm's reach and explain it.",
    "Put on the nearest hat, scarf or blanket and keep it on for the rest of the game.",
    "Let the group choose a word you must use in every sentence until your next turn.",
    "Read your last sent text message out loud.",
    "Do your best runway walk across your room.",
    "Talk like a sports commentator describing what you're doing for one minute.",
    "Make the weirdest face you can and hold it for 10 seconds.",
    "Try to lick your elbow on camera.",
    "Draw a portrait of the person to your left in the grid in 30 seconds and show it.",
    "Do your best dance move for 15 seconds.",
    "Tell a joke. If nobody laughs, tell another one.",
    "Balance something on your head for 30 seconds.",
    "Narrate the next minute of your life like a nature documentary.",
    "Say the alphabet backwards as fast as you can.",
    "Change your display background to something ridiculous (or hold up something silly) for the next round.",
    "Do an infomercial pitch for the closest object to you.",
    "Speak only in questions until your next turn.",
    "Hum a song and let the group guess it.",
    "Give a dramatic reading of a random paragraph from the nearest book, box or label.",
    "Do 15 seconds of your best robot dance.",
    "Let someone in the call pick an emoji you must act out.",
    "Do your best evil villain laugh.",
    "Pretend to be a news anchor and report on what everyone in the call is wearing.",
    "Go two rounds without saying “yes” or “no”.",
    "Show your best yoga pose and hold it for 20 seconds.",
    "Rap the next 3 sentences you say.",
    "Recreate a famous movie scene of the group's choosing.",
    "Do a 30-second stand-up comedy routine about your day.",
    "Speak without moving your lips for the next minute.",
]


@register
class TruthOrDare(Game):
    id = "truth-or-dare"
    name = "Truth or Dare"
    min_players = 2

    SPIN_SECONDS = 2.5
    CHOOSE_SECONDS = 20
    PROMPT_SECONDS = 120
    REROLLS = 1

    def start(self) -> None:
        self.current: Optional[str] = None
        self.previous: Optional[str] = None
        self.choice: Optional[str] = None
        self.prompt: Optional[str] = None
        self.rerolls = self.REROLLS
        self.done: dict[str, dict[str, int]] = {}
        self.decks = {"truth": random.sample(TRUTHS, len(TRUTHS)), "dare": random.sample(DARES, len(DARES))}
        self._spin()

    def _draw(self, kind: str) -> str:
        if not self.decks[kind]:
            src = TRUTHS if kind == "truth" else DARES
            self.decks[kind] = random.sample(src, len(src))
        return self.decks[kind].pop()

    def _spin(self) -> None:
        online = self.ctx.player_ids()
        if len(online) < 2:
            self.finish()
            return
        pool = [p for p in online if p != self.previous] or online
        self.current = random.choice(pool)
        self.choice = None
        self.prompt = None
        self.rerolls = self.REROLLS
        self.set_phase("SPIN", self.SPIN_SECONDS, self._to_choose)

    def _to_choose(self) -> None:
        self.set_phase("CHOOSE", self.CHOOSE_SECONDS, lambda: self._pick(random.choice(["truth", "dare"])))

    def _pick(self, kind: str) -> None:
        if self.phase != "CHOOSE":
            return
        self.choice = kind
        self.prompt = self._draw(kind)
        self.set_phase("PROMPT", self.PROMPT_SECONDS, self._finish_turn)

    def _finish_turn(self) -> None:
        if self.current and self.choice and self.phase == "PROMPT":
            tally = self.done.setdefault(self.current, {"truth": 0, "dare": 0})
            tally[self.choice] += 1
            self.add_points(self.current, 10 if self.choice == "truth" else 15)
        self.previous = self.current
        self._spin()

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action == "choose":
            if pid != self.current or self.phase != "CHOOSE":
                raise ActionError("It's not your turn to choose.")
            kind = payload.get("kind")
            if kind not in ("truth", "dare"):
                raise ActionError("Pick truth or dare.")
            self._pick(kind)
        elif action == "reroll":
            if pid != self.current or self.phase != "PROMPT" or self.rerolls <= 0:
                raise ActionError("No rerolls left.")
            self.rerolls -= 1
            self.prompt = self._draw(self.choice or "truth")
            self.ctx.changed()
        elif action == "done":
            # the player in the hot seat, or anyone else once they've had a moment
            if self.phase != "PROMPT":
                return
            if pid != self.current and (self.remaining_ms() or 0) > (self.PROMPT_SECONDS - 10) * 1000:
                raise ActionError("Give them a few seconds!")
            self._finish_turn()
        else:
            raise ActionError("Unknown action.")

    def on_player_left(self, pid: str) -> None:
        if pid == self.current:
            self.previous = None
            self._spin()

    def view(self, pid: str) -> dict[str, Any]:
        return {
            **self.base_view(),
            "current": self.current,
            "choice": self.choice,
            "prompt": self.prompt,
            "rerolls": self.rerolls if pid == self.current else 0,
            "done": self.done,
            "candidates": self.ctx.player_ids() if self.phase == "SPIN" else None,
            "total_seconds": {"CHOOSE": self.CHOOSE_SECONDS, "PROMPT": self.PROMPT_SECONDS}.get(self.phase),
        }
