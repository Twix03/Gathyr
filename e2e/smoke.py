"""End-to-end smoke test: two (and a third mobile) browser users join a room and play every game.

    python -m venv .venv && .venv/bin/pip install -r e2e/requirements.txt
    .venv/bin/python e2e/smoke.py                         # against http://localhost:5173
    BASE_URL=https://gathyr.app .venv/bin/python e2e/smoke.py

Uses the installed Google Chrome (no browser download) with fake camera/mic.
Screenshots go to e2e/out/.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:5173").rstrip("/")
OUT = Path(__file__).parent / "out"
ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        # Some networks drop HTTP/3 (QUIC) to Cloudflare and Chrome stalls on it.
        "--disable-quic"]
WORDS = {"a": "apple", "b": "bread", "c": "cat", "d": "dog", "e": "eagle", "f": "fish", "g": "goat", "h": "house",
         "i": "island", "j": "jam", "k": "kite", "l": "lemon", "m": "mouse", "n": "nest", "o": "orange", "p": "pear",
         "q": "queen", "r": "river", "s": "snake", "t": "tiger", "u": "umbrella", "v": "violin", "w": "wolf",
         "x": "xylophone", "y": "yellow", "z": "zebra"}

errors: list[str] = []
checks: list[tuple[str, bool]] = []


def check(name: str, ok: bool) -> None:
    checks.append((name, ok))
    print(("  ✓ " if ok else "  ✗ ") + name)


def new_page(browser, width=1280, height=800, mobile=False) -> Page:
    ctx = browser.new_context(viewport={"width": width, "height": height}, permissions=["camera", "microphone"],
                              is_mobile=mobile, has_touch=mobile)
    p = ctx.new_page()
    p.set_default_timeout(30_000)
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    return p


def goto(p: Page, url: str) -> None:
    for _ in range(4):   # flaky networks: retry the initial load, not the app
        try:
            p.goto(url, wait_until="domcontentloaded", timeout=30_000)
            return
        except Exception as e:  # noqa: BLE001
            print(f"  (retrying load: {type(e).__name__})")
    raise RuntimeError(f"could not load {url}")


def join(p: Page, name: str, code: str | None = None) -> str:
    goto(p, f"{BASE}/" + (f"?room={code}" if code else ""))
    if code:
        expect(p.get_by_text(re.compile(r"(is|are) here"))).to_be_visible()
    p.get_by_placeholder("What should we call you?").fill(name)
    p.get_by_role("button", name=re.compile("^(Start a room|Join)")).last.click()
    p.wait_for_url(re.compile(r"/rooms/[A-Z0-9]{6}$"), timeout=60_000)
    wait_connected(p)
    return p.url.rsplit("/", 1)[1]


def wait_connected(p: Page) -> None:
    """Room UI is up and the realtime socket is live (no 'Reconnecting…' badge)."""
    expect(p.get_by_role("button", name="Leave room")).to_be_visible(timeout=60_000)
    expect(p.get_by_text("Reconnecting…")).to_have_count(0, timeout=60_000)


def videos(p: Page) -> list[int]:
    return p.evaluate("() => [...document.querySelectorAll('main video')].filter(v => getComputedStyle(v).visibility === 'visible').map(v => v.videoWidth)")


def heading(p: Page) -> str:
    return p.locator("main h2").first.inner_text()


def start_game(proposer: Page, voter: Page, game: str) -> None:
    proposer.get_by_role("button", name="Games").click()
    card = proposer.locator("div.rounded-xl", has=proposer.get_by_text(game, exact=True)).last
    card.get_by_role("button", name="Propose").click()
    voter.get_by_role("button", name=re.compile("I'm in")).click()
    for p in (proposer, voter):
        expect(p.get_by_role("button", name="End game")).to_be_visible()


def end_game(a: Page, b: Page) -> None:
    a.get_by_role("button", name="End game").click()   # 1 of 2 players = half → ends
    for p in (a, b):
        expect(p.get_by_role("button", name="End game")).to_have_count(0)


def run() -> None:
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        br = pw.chromium.launch(channel="chrome", headless=True, args=ARGS)
        a, b = new_page(br), new_page(br)

        print("room")
        code = join(a, "Ana")
        join(b, "Ben", code)
        a.wait_for_function("() => [...document.querySelectorAll('main video')].filter(v => v.videoWidth > 0).length >= 2",
                            timeout=30_000)
        check("both see two live videos", len([w for w in videos(a) if w]) == 2 and len([w for w in videos(b) if w]) >= 1)
        check("remote audio rendered exactly once", a.evaluate("document.querySelectorAll('audio').length") == 1)
        a.screenshot(path=OUT / "room.png")

        wait_connected(b)
        b.get_by_role("button", name="Chat").click()
        b.get_by_placeholder("Message everyone").fill("hey ana")
        b.keyboard.press("Enter")
        expect(a.get_by_text("hey ana").first).to_be_visible()
        check("chat notification", True)

        b.get_by_role("button", name="Turn camera off").click()
        a.wait_for_function("() => [...document.querySelectorAll('main video')].filter(v => getComputedStyle(v).visibility === 'visible').length === 1")
        b.get_by_role("button", name="Turn camera on").click()
        a.wait_for_function("() => [...document.querySelectorAll('main video')].filter(v => getComputedStyle(v).visibility === 'visible' && v.videoWidth > 0).length === 2",
                            timeout=20_000)
        check("camera off/on reflected immediately", True)
        b.get_by_role("button", name="Close panel").click()

        b.reload(wait_until="domcontentloaded")
        wait_connected(b)
        expect(a.get_by_text("2 here")).to_be_visible()
        check("refresh keeps the same seat", b.url.endswith(code))

        print("scribble")
        start_game(a, b, "Scribble")
        drawer = a if a.get_by_text("Pick a word to draw").count() else b
        guesser = b if drawer is a else a
        expect(drawer.get_by_text("Pick a word to draw")).to_be_visible()
        drawer.locator("button.capitalize").first.click()
        expect(drawer.locator("main h2").first).to_contain_text("Draw:")
        word = heading(drawer).split("Draw:", 1)[1].strip()
        check("guesser can't see the word", word.lower() not in heading(guesser).lower())
        box = drawer.locator("canvas").bounding_box()
        drawer.mouse.move(box["x"] + 60, box["y"] + 60)
        drawer.mouse.down()
        for i in range(30):
            drawer.mouse.move(box["x"] + 60 + i * 10, box["y"] + 60 + (i % 7) * 12)
        drawer.mouse.up()
        guesser.wait_for_function("""() => { const c = document.querySelector('canvas'); if (!c) return false;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 16) if (d[i] < 100) return true; return false; }""", timeout=15_000)
        check("strokes reach the guesser", True)
        guesser.get_by_placeholder("Type your guess").fill(word)
        guesser.keyboard.press("Enter")
        expect(guesser.locator("main h2").first).to_contain_text(re.compile(f"(got it|word was).*{re.escape(word)}", re.I))
        check("correct guess accepted", True)
        guesser.screenshot(path=OUT / "scribble.png")
        end_game(a, b)

        print("trivia")
        start_game(b, a, "Trivia")
        for p in (a, b):
            expect(p.get_by_text(re.compile(r"Question 1 of"))).to_be_visible(timeout=15_000)
        a.locator("main button").nth(0).click()
        b.locator("main button").nth(1).click()
        expect(a.get_by_text(re.compile(r"(\+\d+ points|Not this time)"))).to_be_visible()
        check("trivia reveals after both answer", True)
        end_game(a, b)

        print("word chain")
        start_game(a, b, "Word Chain")
        expect(a.locator("main h2").first).to_contain_text("turn")
        cur = a if "Your turn" in heading(a) else b
        other = b if cur is a else a
        letter = re.search(r"starts with (\w)", heading(cur)).group(1).lower()
        cur.locator("main input").fill(WORDS[letter])
        cur.keyboard.press("Enter")
        expect(other.locator("main h2").first).to_contain_text("Your turn")
        check("valid word passes the turn", True)
        end_game(a, b)

        print("quick draw")
        start_game(a, b, "Quick Draw")
        expect(a.get_by_text("TAP!")).to_be_visible(timeout=10_000)
        a.wait_for_timeout(300)   # human-speed; <100ms counts as a guess
        for p in (a, b):
            p.locator("main button").first.dispatch_event("pointerdown")
        expect(a.get_by_text(re.compile(r"^\d+ ms$")).first).to_be_visible()
        check("reaction times recorded", True)
        end_game(a, b)

        print("two truths")
        start_game(b, a, "Two Truths & a Lie")
        for p, n in ((a, "Ana"), (b, "Ben")):
            inputs = p.locator("main input")
            for i in range(3):
                inputs.nth(i).fill(f"{n} fact {i}")
            p.get_by_role("button", name="Lie").nth(1).click()
            p.get_by_role("button", name="Lock it in").click()
        for p in (a, b):   # wait until voting has started on both screens
            expect(p.locator("main h2").first).not_to_contain_text("Write two truths")
        voter = a if a.get_by_text("Which one is").count() else b
        voter.locator("main button").nth(1).click()
        expect(voter.get_by_text("LIE", exact=True)).to_be_visible()
        check("lie revealed after voting", True)
        end_game(a, b)

        print("mobile")
        m = new_page(br, 390, 844, mobile=True)
        join(m, "Cy", code)
        expect(a.get_by_text("3 here")).to_be_visible()
        m.screenshot(path=OUT / "mobile.png")
        check("mobile participant joins", True)
        br.close()


if __name__ == "__main__":
    print(f"smoke test against {BASE}")
    try:
        run()
    except Exception as e:  # noqa: BLE001
        checks.append((f"crashed: {type(e).__name__}: {str(e).splitlines()[0][:160]}", False))
        print("  ✗", checks[-1][0])
    print("console errors:", errors[:5] or "none")
    failed = [n for n, ok in checks if not ok] + (["console errors"] if errors else [])
    print("PASS" if not failed else f"FAIL: {failed}")
    sys.exit(1 if failed else 0)
