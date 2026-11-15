"""Trivia: everyone answers the same question; faster correct answers score more."""
from __future__ import annotations

import random
import time
from typing import Any

from . import register
from .base import ActionError, Game

# (category, question, correct answer, three wrong answers)
QUESTIONS: list[tuple[str, str, str, list[str]]] = [
    ("Geography", "What is the capital of Australia?", "Canberra", ["Sydney", "Melbourne", "Perth"]),
    ("Geography", "Which river flows through Cairo?", "Nile", ["Tigris", "Danube", "Congo"]),
    ("Geography", "Which country has the most people?", "India", ["China", "United States", "Indonesia"]),
    ("Geography", "Mount Kilimanjaro is in which country?", "Tanzania", ["Kenya", "Uganda", "Ethiopia"]),
    ("Geography", "What is the largest ocean?", "Pacific", ["Atlantic", "Indian", "Arctic"]),
    ("Geography", "Which is the smallest country in the world?", "Vatican City", ["Monaco", "San Marino", "Malta"]),
    ("Geography", "Reykjavík is the capital of…", "Iceland", ["Norway", "Finland", "Greenland"]),
    ("Geography", "Which desert is the largest hot desert?", "Sahara", ["Gobi", "Kalahari", "Atacama"]),
    ("Geography", "How many continents are there?", "7", ["5", "6", "8"]),
    ("Geography", "Which country is shaped like a boot?", "Italy", ["Greece", "Portugal", "Chile"]),
    ("Science", "What is the chemical symbol for gold?", "Au", ["Ag", "Gd", "Go"]),
    ("Science", "Which planet is known as the Red Planet?", "Mars", ["Venus", "Jupiter", "Mercury"]),
    ("Science", "What gas do plants absorb from the air?", "Carbon dioxide", ["Oxygen", "Nitrogen", "Helium"]),
    ("Science", "How many bones are in the adult human body?", "206", ["186", "212", "256"]),
    ("Science", "What is the hardest natural substance?", "Diamond", ["Quartz", "Titanium", "Granite"]),
    ("Science", "Which planet has the most moons?", "Saturn", ["Jupiter", "Neptune", "Uranus"]),
    ("Science", "What is H2O better known as?", "Water", ["Hydrogen peroxide", "Salt", "Ammonia"]),
    ("Science", "What part of the cell holds most of its DNA?", "Nucleus", ["Ribosome", "Membrane", "Mitochondria"]),
    ("Science", "At sea level, water boils at what °C?", "100", ["90", "110", "120"]),
    ("Science", "Which organ pumps blood around the body?", "Heart", ["Liver", "Lungs", "Kidneys"]),
    ("Science", "What force keeps us on the ground?", "Gravity", ["Magnetism", "Friction", "Inertia"]),
    ("Science", "Light from the Sun takes about how long to reach Earth?", "8 minutes", ["8 seconds", "1 hour", "1 day"]),
    ("History", "In which year did World War II end?", "1945", ["1944", "1946", "1939"]),
    ("History", "Who was the first person to walk on the Moon?", "Neil Armstrong", ["Buzz Aldrin", "Yuri Gagarin", "John Glenn"]),
    ("History", "Which ancient wonder stood in Egypt and still exists?", "Great Pyramid of Giza",
     ["Colossus of Rhodes", "Hanging Gardens", "Lighthouse of Alexandria"]),
    ("History", "The Berlin Wall fell in which year?", "1989", ["1991", "1985", "1979"]),
    ("History", "Who painted the Mona Lisa?", "Leonardo da Vinci", ["Michelangelo", "Raphael", "Botticelli"]),
    ("History", "Which empire built Machu Picchu?", "Inca", ["Aztec", "Maya", "Olmec"]),
    ("History", "The Titanic sank in which year?", "1912", ["1905", "1915", "1921"]),
    ("History", "Who was the first emperor of Rome?", "Augustus", ["Julius Caesar", "Nero", "Caligula"]),
    ("Pop culture", "Which band sang 'Hey Jude'?", "The Beatles", ["The Rolling Stones", "Queen", "The Who"]),
    ("Pop culture", "What is the name of Harry Potter's owl?", "Hedwig", ["Errol", "Pigwidgeon", "Fawkes"]),
    ("Pop culture", "In 'Finding Nemo', what kind of fish is Nemo?", "Clownfish", ["Goldfish", "Angelfish", "Pufferfish"]),
    ("Pop culture", "Which company makes the PlayStation?", "Sony", ["Nintendo", "Microsoft", "Sega"]),
    ("Pop culture", "Which superhero is from Wakanda?", "Black Panther", ["Storm", "Shang-Chi", "Falcon"]),
    ("Pop culture", "What is the best-selling video game of all time?", "Minecraft", ["Tetris", "GTA V", "Wii Sports"]),
    ("Pop culture", "Who is Mickey Mouse's girlfriend?", "Minnie", ["Daisy", "Clarabelle", "Betty"]),
    ("Pop culture", "Which movie features the line 'I'll be back'?", "The Terminator", ["Rambo", "Die Hard", "Predator"]),
    ("Food", "Which country is the origin of sushi?", "Japan", ["China", "Korea", "Thailand"]),
    ("Food", "What is the main ingredient in guacamole?", "Avocado", ["Tomato", "Lime", "Pea"]),
    ("Food", "Which nut is used to make marzipan?", "Almond", ["Walnut", "Cashew", "Hazelnut"]),
    ("Food", "Paella comes from which country?", "Spain", ["Italy", "Mexico", "Portugal"]),
    ("Food", "Which fruit wears its seeds on the outside?", "Strawberry", ["Raspberry", "Kiwi", "Fig"]),
    ("Food", "Which spice comes from crocus flowers?", "Saffron", ["Turmeric", "Paprika", "Cardamom"]),
    ("Sport", "How many players are on a football (soccer) team on the field?", "11", ["9", "10", "12"]),
    ("Sport", "Which country has won the most FIFA World Cups?", "Brazil", ["Germany", "Italy", "Argentina"]),
    ("Sport", "In tennis, what is zero called?", "Love", ["Nil", "Duck", "Zip"]),
    ("Sport", "How many rings are on the Olympic flag?", "5", ["4", "6", "7"]),
    ("Sport", "Which sport uses a shuttlecock?", "Badminton", ["Squash", "Table tennis", "Volleyball"]),
    ("Sport", "How long is a marathon (approx.)?", "42 km", ["26 km", "36 km", "50 km"]),
    ("Language", "Which is the most spoken native language in the world?", "Mandarin Chinese",
     ["English", "Spanish", "Hindi"]),
    ("Language", "What does 'gracias' mean?", "Thank you", ["Hello", "Please", "Goodbye"]),
    ("Language", "How many letters are in the English alphabet?", "26", ["24", "25", "28"]),
    ("Nature", "What is the fastest land animal?", "Cheetah", ["Lion", "Pronghorn", "Greyhound"]),
    ("Nature", "What do bees make?", "Honey", ["Silk", "Wax paper", "Nectar wine"]),
    ("Nature", "Which is the largest mammal?", "Blue whale", ["Elephant", "Giraffe", "Sperm whale"]),
    ("Nature", "How many legs does a spider have?", "8", ["6", "10", "12"]),
    ("Nature", "A group of crows is called a…", "Murder", ["Flock", "Parliament", "Gaggle"]),
    ("Nature", "What is a baby kangaroo called?", "Joey", ["Kit", "Cub", "Pup"]),
    ("Tech", "What does 'www' stand for?", "World Wide Web", ["World Web Wide", "Wide World Web", "Web World Wide"]),
]


@register
class Trivia(Game):
    id = "trivia"
    name = "Trivia"
    min_players = 1

    QUESTIONS_PER_GAME = 10
    ANSWER_SECONDS = 15
    REVEAL_SECONDS = 5
    READY_SECONDS = 3

    def start(self) -> None:
        picked = random.sample(QUESTIONS, min(self.QUESTIONS_PER_GAME, len(QUESTIONS)))
        self.questions = []
        for cat, q, right, wrong in picked:
            options = [right, *wrong]
            random.shuffle(options)
            self.questions.append({"category": cat, "question": q, "options": options,
                                   "answer": options.index(right)})
        self.index = -1
        self.answers: dict[str, tuple[int, float]] = {}
        self.gained: dict[str, int] = {}
        self.asked_at = 0.0
        self.set_phase("READY", self.READY_SECONDS, self._next)

    def _next(self) -> None:
        self.index += 1
        if self.index >= len(self.questions):
            self.finish()
            return
        self.answers = {}
        self.gained = {}
        self.asked_at = time.monotonic()
        self.set_phase("QUESTION", self.ANSWER_SECONDS, self._reveal)

    def _reveal(self) -> None:
        if self.phase != "QUESTION":
            return
        correct = self.questions[self.index]["answer"]
        for pid, (choice, at) in self.answers.items():
            if choice == correct:
                ratio = max(0.0, 1 - (at - self.asked_at) / self.ANSWER_SECONDS)
                pts = 100 + int(100 * ratio)
                self.gained[pid] = pts
                self.add_points(pid, pts)
        self.set_phase("REVEAL", self.REVEAL_SECONDS, self._next)

    def on_action(self, pid: str, action: str, payload: dict[str, Any]) -> None:
        if action != "answer":
            raise ActionError("Unknown action.")
        if self.phase != "QUESTION":
            return
        choice = payload.get("index")
        if choice not in (0, 1, 2, 3) or pid in self.answers:
            return
        self.answers[pid] = (choice, time.monotonic())
        self.ctx.changed()
        self._maybe_reveal()

    def _maybe_reveal(self) -> None:
        online = self.ctx.player_ids()
        if self.phase == "QUESTION" and online and all(p in self.answers for p in online):
            self._reveal()

    def on_presence(self, pid: str, connected: bool) -> None:
        if not connected:
            self._maybe_reveal()

    def on_player_left(self, pid: str) -> None:
        self._maybe_reveal()

    def view(self, pid: str) -> dict[str, Any]:
        q = self.questions[self.index] if 0 <= self.index < len(self.questions) else None
        revealing = self.phase == "REVEAL"
        return {
            **self.base_view(),
            "number": self.index + 1,
            "total": len(self.questions),
            "category": q["category"] if q else None,
            "question": q["question"] if q else None,
            "options": q["options"] if q else None,
            "my_answer": self.answers[pid][0] if pid in self.answers else None,
            "answered": list(self.answers),
            "correct": q["answer"] if q and revealing else None,
            "choices": {p: a[0] for p, a in self.answers.items()} if revealing else None,
            "gained": self.gained if revealing else None,
            "total_seconds": {"QUESTION": self.ANSWER_SECONDS, "REVEAL": self.REVEAL_SECONDS,
                              "READY": self.READY_SECONDS}.get(self.phase),
        }
