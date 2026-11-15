import os

os.environ.setdefault("LIVEKIT_API_KEY", "testkey")
os.environ.setdefault("LIVEKIT_API_SECRET", "testsecret_testsecret_testsecret_00")
os.environ.setdefault("FEEDBACK_PATH", "/tmp/gathyr-test-feedback.jsonl")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from gathyr.games import REGISTRY  # noqa: E402
from gathyr.games.base import ActionError, Game  # noqa: E402
from gathyr.main import app  # noqa: E402
from gathyr.rooms import manager  # noqa: E402


class CounterGame(Game):
    """Minimal game used to exercise the engine plumbing."""
    id = "counter"
    name = "Counter"
    min_players = 1

    def start(self):
        self.count = 0
        self.set_phase("PLAYING")

    def on_action(self, pid, action, payload):
        if action != "inc":
            raise ActionError("nope")
        self.count += 1
        self.add_points(pid, 1)
        if self.count >= 3:
            self.finish()
        self.ctx.changed()

    def view(self, pid):
        return {**self.base_view(), "count": self.count, "me": pid}


REGISTRY.setdefault("counter", CounterGame)


@pytest.fixture
def client():
    manager.rooms.clear()
    manager.sessions.clear()
    with TestClient(app) as c:
        yield c


def recv_until(ws, kind, limit=30):
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == kind:
            return msg
    raise AssertionError(f"never received {kind}")


def open_socket(client, code, token):
    ws = client.websocket_connect(f"/ws/room/{code}")
    sock = ws.__enter__()
    sock.send_json({"type": "auth", "token": token})
    assert recv_until(sock, "welcome")
    return ws, sock
