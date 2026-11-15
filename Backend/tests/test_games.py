import pytest

from gathyr.games.base import ActionError
from gathyr.games.reaction import Reaction
from gathyr.games.scribble import Scribble
from gathyr.games.trivia import Trivia
from gathyr.games.truth_or_dare import TruthOrDare
from gathyr.games.two_truths import TwoTruths
from gathyr.games.wordchain import WordChain, is_word
from tests.fake_ctx import FakeCtx


def make(cls, players=("a", "b", "c")):
    ctx = FakeCtx(players)
    g = cls(ctx)
    g.start()
    return g, ctx


# ---------------------------------------------------------------- scribble
def test_scribble_turn_flow_and_secrecy():
    g, ctx = make(Scribble)
    assert g.phase == "CHOOSING"
    drawer = g.drawer
    guessers = [p for p in "abc" if p != drawer]
    assert g.view(drawer)["choices"] and g.view(guessers[0])["choices"] is None

    g.on_action(drawer, "choose", {"index": 1})
    assert g.phase == "DRAWING"
    word = g.word
    assert g.view(drawer)["word"] == word
    assert g.view(guessers[0])["word"] is None
    assert set(g.view(guessers[0])["mask"]) <= {"_", " "}

    with pytest.raises(ActionError):
        g.on_action(guessers[0], "choose", {"index": 0})

    g.on_action(drawer, "stroke", {"s": 1, "c": "#000000", "w": 4, "p": [0.1, 0.1, 0.2, 0.2]})
    assert ctx.events[-1][0] == "stroke" and ctx.events[-1][3] == drawer   # excluded drawer

    g.on_action(guessers[0], "guess", {"text": word.upper()})
    assert guessers[0] in g.guessed and g.scores[guessers[0]] > 100 and g.scores[drawer] == 40
    # once guessed, they can see the word, and their chat can't spoil it
    assert g.view(guessers[0])["word"] == word
    g.on_action(guessers[0], "guess", {"text": word})
    assert not any(e[0] == "guess" and e[1].get("text") == word for e in ctx.events)

    g.on_action(guessers[1], "guess", {"text": word})
    assert g.phase == "REVEAL"   # everyone guessed -> early end
    assert g.view(guessers[1])["turn_points"][drawer] == 80


def test_scribble_close_guess_is_private():
    g, ctx = make(Scribble, ("a", "b"))
    g.on_action(g.drawer, "choose", {"index": 0})
    g.word = "penguin"
    guesser = "a" if g.drawer == "b" else "b"
    g.on_action(guesser, "guess", {"text": "pengun"})
    type_, payload, to, _ = ctx.events[-1]
    assert type_ == "guess" and payload["close"] and to == guesser


def test_scribble_drawer_leaving_ends_turn_and_game_finishes():
    g, ctx = make(Scribble)
    g.on_action(g.drawer, "choose", {"index": 0})
    drawer = g.drawer
    ctx.online.discard(drawer)
    g.on_player_left(drawer)
    assert g.phase == "REVEAL"
    for _ in range(40):
        if g.finished:
            break
        ctx.fire()
    assert g.finished and g.phase == "FINISHED"


def test_scribble_rejects_bad_strokes():
    g, _ = make(Scribble)
    g.on_action(g.drawer, "choose", {"index": 0})
    for bad in ({"s": 1, "c": "red", "w": 4, "p": [0, 0, 1, 1]},
                {"s": 1, "c": "#000000", "w": 999, "p": [0, 0, 1, 1]},
                {"s": 1, "c": "#000000", "w": 4, "p": [0, 0, 1]}):
        with pytest.raises(ActionError):
            g.on_action(g.drawer, "stroke", bad)


# ---------------------------------------------------------------- trivia
def test_trivia_scoring_and_early_reveal():
    g, ctx = make(Trivia, ("a", "b"))
    ctx.fire_phase(g, "READY")
    assert g.phase == "QUESTION"
    q = g.questions[g.index]
    assert g.view("a")["correct"] is None
    g.on_action("a", "answer", {"index": q["answer"]})
    g.on_action("b", "answer", {"index": (q["answer"] + 1) % 4})
    assert g.phase == "REVEAL"
    v = g.view("b")
    assert v["correct"] == q["answer"] and v["gained"]["a"] >= 190 and "b" not in v["gained"]
    while not g.finished:
        if g.phase == "QUESTION":
            ctx.fire()
        else:
            ctx.fire()
    assert g.leaderboard()[0]["id"] == "a"


# ---------------------------------------------------------------- reaction
def test_reaction_false_start_and_hidden_wait():
    g, ctx = make(Reaction, ("a", "b"))
    assert g.phase == "WAIT" and g.view("a")["deadline_ms"] is None
    g.on_action("a", "tap", {})
    assert g.view("a")["false_start"] and g.scores["a"] == -25
    ctx.fire_phase(g, "WAIT")
    assert g.phase == "GO"
    g.go_at -= 0.3   # 300ms later
    g.on_action("b", "tap", {"ms": 250})
    assert g.phase == "RESULT"
    assert g.view("a")["results"][0] == {"id": "b", "ms": 250}


def test_reaction_cannot_claim_faster_than_server_saw():
    g, ctx = make(Reaction, ("a",))
    ctx.fire_phase(g, "WAIT")
    g.go_at -= 0.2
    g.on_action("a", "tap", {"ms": 5000})   # impossible: server only saw ~200ms
    assert 150 <= g.times["a"] <= 400


# ---------------------------------------------------------------- word chain
def test_dictionary_is_lenient_with_inflections():
    assert is_word("cats") and is_word("running") and is_word("baked") and is_word("cities")
    assert not is_word("qzxv")


def test_wordchain_rules_and_lives():
    g, ctx = make(WordChain, ("a", "b"))
    cur = g.current
    letter = g.letter
    with pytest.raises(ActionError):
        g.on_action("a" if cur == "b" else "b", "word", {"word": "anything"})
    with pytest.raises(ActionError):
        g.on_action(cur, "word", {"word": "zzzz" if letter != "z" else "aaaa"})
    with pytest.raises(ActionError):
        g.on_action(cur, "word", {"word": g.letter + "qzxvq"})   # not a word
    assert g.current == cur  # invalid attempts don't end the turn
    good = next(w for w in ("eagle", "tiger", "rabbit", "nest", "rocket", "orange", "lemon", "dog", "yak",
                            "kite", "apple", "goat", "hat", "ant", "mouse", "snake", "zebra", "car", "wolf") if w[0] == g.letter)
    g.on_action(cur, "word", {"word": good})
    assert g.chain[-1] == {"word": good, "pid": cur} and g.current != cur
    cur = g.current
    ctx.fire()   # timeout costs a life
    assert g.lives[cur] == 1 and g.current != cur
    for _ in range(4):
        if g.finished:
            break
        ctx.fire()
    assert g.finished


# ---------------------------------------------------------------- truth or dare
def test_truth_or_dare_flow():
    g, ctx = make(TruthOrDare)
    ctx.fire_phase(g, "SPIN")
    cur = g.current
    other = next(p for p in "abc" if p != cur)
    with pytest.raises(ActionError):
        g.on_action(other, "choose", {"kind": "truth"})
    g.on_action(cur, "choose", {"kind": "dare"})
    assert g.phase == "PROMPT" and g.prompt
    g.on_action(cur, "reroll", {})
    assert g.rerolls == 0 and g.prompt
    with pytest.raises(ActionError):
        g.on_action(cur, "reroll", {})
    with pytest.raises(ActionError):
        g.on_action(other, "done", {})   # too soon for others
    g.on_action(cur, "done", {})
    assert g.phase == "SPIN" and g.done[cur]["dare"] == 1 and g.current != cur


# ---------------------------------------------------------------- two truths
def test_two_truths_full_round():
    g, ctx = make(TwoTruths, ("a", "b"))
    with pytest.raises(ActionError):
        g.on_action("a", "submit", {"statements": ["x", "y"], "lie": 0})
    g.on_action("a", "submit", {"statements": ["I have a cat", "I can juggle", "I've been to Peru"], "lie": 1})
    assert g.phase == "WRITE"
    g.on_action("b", "submit", {"statements": ["one", "two", "three"], "lie": 2})
    assert g.phase == "VOTE"
    author = g.author
    voter = "b" if author == "a" else "a"
    assert g.view(voter)["lie"] is None
    g.on_action(voter, "vote", {"index": g.entries[author]["lie"]})
    assert g.phase == "REVEAL" and g.scores[voter] == 100
    ctx.fire_phase(g, "REVEAL")
    assert g.phase == "VOTE" and g.author == voter
    g.on_action(author, "vote", {"index": (g.entries[voter]["lie"] + 1) % 3})
    assert g.scores[voter] == 150   # fooled one player
    ctx.fire_phase(g, "REVEAL")
    assert g.finished
