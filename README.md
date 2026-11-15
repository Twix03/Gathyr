# Gathyr

Video calls with games built in. Open a room, invite friends with a 6-letter code, and play
Scribble, Trivia, Quick Draw, Word Chain, Truth or Dare or Two Truths & a Lie — in the browser.

## How it fits together

```
Browser ──HTTPS──▶ Caddy ──▶ Frontend/dist (static React app)
   │                  └────▶ FastAPI :8000   /api/*  REST: create / join / resume / leave
   │                                         /ws/*   realtime room + game state
   └──WebRTC─────────────▶ LiveKit :7880     audio / video / screen share (SFU)
```

- **Backend** (`Backend/gathyr`) is the single source of truth for rooms and games. Clients send
  *intents* (`propose`, `vote`, `game_action`…); the server validates them, runs all timers and
  pushes each player a personalised snapshot. State is in memory, so run **one** worker.
- **Games** (`Backend/gathyr/games`) implement `start / on_action / view` on top of a small engine
  (`base.py`). Deadlines go over the wire as *remaining ms*, so client clocks don't matter.
- **Frontend** (`Frontend/src`): `lib/` realtime client + room store, `media/` LiveKit integration,
  `room/` call UI, `games/` one screen per game, `ui/` primitives and design tokens.

### Auth model
Joining returns a secret `session_token` (kept in localStorage per room) and a LiveKit token.
The participant `id` is public and is **not** a credential. The WebSocket authenticates with the
token in its first message. Hosts can remove people (also removed from LiveKit) and ask to mute;
mute requests are LiveKit data packets that clients only accept from the current host.

## Local development

Requires Python 3.10+, Node 22, and `livekit-server` (`brew install livekit`).

```bash
cd Backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && cd ..
cd Frontend && npm install && cd ..
./dev/start-dev.sh      # app http://localhost:5173 · API :8001 · LiveKit :7882
./dev/stop-dev.sh
```

Open the app in two browser windows (one private) to play against yourself.

### Checks
```bash
cd Backend && .venv/bin/python -m pytest -q     # room, vote and game-rule tests
cd Frontend && npm run build                      # typecheck + production build
```
CI runs both on every push and pull request.

End-to-end smoke test (two real Chrome users with fake cameras: call, chat, refresh, every game):
```bash
uv venv e2e/.venv && uv pip install --python e2e/.venv/bin/python -r e2e/requirements.txt   # or python -m venv
e2e/.venv/bin/python e2e/smoke.py                              # local dev stack
BASE_URL=https://gathyr.app e2e/.venv/bin/python e2e/smoke.py  # production, after deploying
```

### Adding a game
1. `Backend/gathyr/games/<name>.py`: subclass `Game`, decorate with `@register`, import it at the
   bottom of `games/__init__.py`, add tests in `Backend/tests/test_games.py` (use `FakeCtx`).
2. `Frontend/src/games/<Name>.tsx`: render `state` from `view()`, send `store.gameAction(...)`.
   Register it in `games/index.ts` and add catalogue info in `games/catalog.ts`.

## Deploying
See [deploy/DEPLOY.md](deploy/DEPLOY.md).
