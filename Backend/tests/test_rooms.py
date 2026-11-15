import pytest
from starlette.websockets import WebSocketDisconnect

from gathyr.config import settings
from gathyr.rooms import manager
from tests.conftest import open_socket, recv_until


def close(ctx):
    try:
        ctx.__exit__(None, None, None)
    except Exception:
        pass


def create(client, name="Ana"):
    r = client.post("/api/rooms", json={"name": name})
    assert r.status_code == 201
    return r.json()


def join(client, code, name="Ben"):
    r = client.post(f"/api/rooms/{code}/join", json={"name": name})
    assert r.status_code == 200, r.text
    return r.json()


def test_create_resume_and_preview(client):
    a = create(client)
    code = a["room"]["code"]
    assert a["room"]["host_id"] == a["participant"]["id"]
    assert a["session_token"] and a["livekit_token"]

    r = client.post(f"/api/rooms/{code}/session", headers={"Authorization": f"Bearer {a['session_token']}"})
    assert r.status_code == 200
    assert r.json()["participant"]["id"] == a["participant"]["id"]

    # The public participant id is NOT a credential
    r = client.post(f"/api/rooms/{code}/session", headers={"Authorization": f"Bearer {a['participant']['id']}"})
    assert r.status_code == 401

    preview = client.get(f"/api/rooms/{code}").json()
    assert preview["participant_count"] == 1
    assert "id" not in str(preview["names"])
    assert client.get("/api/rooms/NOPE99").status_code == 404


def test_name_validation(client):
    assert client.post("/api/rooms", json={"name": "   "}).status_code == 422
    assert client.post("/api/rooms", json={"name": "x" * 30}).status_code == 422


def test_ws_rejects_bad_token(client):
    a = create(client)
    with client.websocket_connect(f"/ws/room/{a['room']['code']}") as ws:
        ws.send_json({"type": "auth", "token": "garbage"})
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4004


def test_presence_and_chat(client):
    a = create(client)
    code = a["room"]["code"]
    ctx_a, ws_a = open_socket(client, code, a["session_token"])
    b = join(client, code)
    ctx_b, ws_b = open_socket(client, code, b["session_token"])

    state = recv_until(ws_a, "room_state")
    while not all(p["connected"] for p in state["data"]["participants"]) or len(state["data"]["participants"]) < 2:
        state = recv_until(ws_a, "room_state")

    ws_b.send_json({"type": "chat", "data": {"text": "  hello  "}})
    msg = recv_until(ws_a, "chat")
    assert msg["data"]["text"] == "hello" and msg["data"]["sender_id"] == b["participant"]["id"]

    # late joiner gets history
    c = join(client, code, "Cy")
    ctx_c = client.websocket_connect(f"/ws/room/{code}")
    ws_c = ctx_c.__enter__()
    ws_c.send_json({"type": "auth", "token": c["session_token"]})
    hist = recv_until(ws_c, "chat_history")
    assert [m["text"] for m in hist["data"]["messages"]] == ["hello"]
    for ctx in (ctx_a, ctx_b, ctx_c):
        ctx.__exit__(None, None, None)


def test_second_tab_replaces_first_without_going_offline(client):
    a = create(client)
    code = a["room"]["code"]
    ctx1, ws1 = open_socket(client, code, a["session_token"])
    ctx2, ws2 = open_socket(client, code, a["session_token"])
    with pytest.raises(WebSocketDisconnect) as e:
        for _ in range(20):
            ws1.receive_json()
    assert e.value.code == 4001
    close(ctx1)
    room = manager.get_room(code)
    assert room.participants[a["participant"]["id"]].connected is True
    ctx2.__exit__(None, None, None)


def test_start_needs_majority_and_end_needs_half(client):
    a = create(client)
    code = a["room"]["code"]
    ctx_a, ws_a = open_socket(client, code, a["session_token"])
    b = join(client, code)
    ctx_b, ws_b = open_socket(client, code, b["session_token"])

    ws_a.send_json({"type": "propose", "data": {"type": "START", "game_id": "counter"}})
    st = recv_until(ws_b, "room_state")
    while not st["data"]["proposal"]:
        st = recv_until(ws_b, "room_state")
    assert st["data"]["game"] is None  # 1 of 2 is not a majority

    ws_b.send_json({"type": "vote", "data": {"vote": True}})
    res = recv_until(ws_a, "proposal_result")
    assert res["data"]["passed"] is True
    gs = recv_until(ws_a, "game_state")
    assert gs["data"]["state"]["count"] == 0 and gs["data"]["state"]["me"] == a["participant"]["id"]

    ws_b.send_json({"type": "game_action", "data": {"action": "inc", "payload": {}}})
    gs = recv_until(ws_a, "game_state")
    assert gs["data"]["state"]["count"] == 1

    # one of two players can end a game (50%)
    ws_b.send_json({"type": "propose", "data": {"type": "END"}})
    res = recv_until(ws_a, "proposal_result")
    assert res["data"] == {"type": "END", "game_id": "counter", "passed": True}
    assert manager.get_room(code).game is None
    for ctx in (ctx_a, ctx_b):
        ctx.__exit__(None, None, None)


def test_disconnected_players_dont_block_votes(client):
    a = create(client)
    code = a["room"]["code"]
    join(client, code, "Ghost1")
    join(client, code, "Ghost2")      # never connect
    ctx_a, ws_a = open_socket(client, code, a["session_token"])
    ws_a.send_json({"type": "propose", "data": {"type": "START", "game_id": "counter"}})
    assert recv_until(ws_a, "proposal_result")["data"]["passed"] is True
    ctx_a.__exit__(None, None, None)


def test_finished_game_returns_to_lobby(client):
    a = create(client)
    code = a["room"]["code"]
    ctx_a, ws_a = open_socket(client, code, a["session_token"])
    ws_a.send_json({"type": "propose", "data": {"type": "START", "game_id": "counter"}})
    recv_until(ws_a, "proposal_result")
    ws_a.send_json({"type": "game_action", "data": {"action": "return_to_lobby", "payload": {}}})
    assert recv_until(ws_a, "error")["data"]["message"].startswith("The game is still going")
    for _ in range(3):
        ws_a.send_json({"type": "game_action", "data": {"action": "inc", "payload": {}}})
    st = recv_until(ws_a, "game_state")
    while not st["data"]["state"]["finished"]:
        st = recv_until(ws_a, "game_state")
    assert st["data"]["state"]["leaderboard"][0]["score"] == 3
    ws_a.send_json({"type": "game_action", "data": {"action": "return_to_lobby", "payload": {}}})
    gs = recv_until(ws_a, "game_state")
    while gs["data"] is not None:
        gs = recv_until(ws_a, "game_state")
    assert manager.get_room(code).last_played == "counter"
    ctx_a.__exit__(None, None, None)


def test_kick_is_host_only_and_grace_sweep(client, monkeypatch):
    a = create(client)
    code = a["room"]["code"]
    b = join(client, code)
    c = join(client, code, "Cy")
    ctx_b, ws_b = open_socket(client, code, b["session_token"])
    ws_b.send_json({"type": "kick", "data": {"participant_id": c["participant"]["id"]}})
    assert "host" in recv_until(ws_b, "error")["data"]["message"]

    ctx_a, ws_a = open_socket(client, code, a["session_token"])
    ws_a.send_json({"type": "kick", "data": {"participant_id": b["participant"]["id"]}})
    with pytest.raises(WebSocketDisconnect) as e:
        for _ in range(30):
            ws_b.receive_json()
    assert e.value.code == 4003
    close(ctx_b)
    assert b["participant"]["id"] not in manager.get_room(code).participants

    # Cy never connected: swept after grace period
    monkeypatch.setattr(settings, "disconnect_grace_seconds", -1)
    client.portal.call(manager.sweep)
    room = manager.get_room(code)
    assert list(room.participants) == [a["participant"]["id"]]
    ctx_a.__exit__(None, None, None)


def test_leave_last_person_deletes_room(client):
    a = create(client)
    code = a["room"]["code"]
    r = client.delete(f"/api/rooms/{code}/session", headers={"Authorization": f"Bearer {a['session_token']}"})
    assert r.status_code == 204
    assert manager.get_room(code) is None


def test_feedback(client):
    assert client.post("/api/feedback", json={"type": "bug", "text": "it broke"}).status_code == 201
    assert client.post("/api/feedback", json={"type": "evil", "text": "x"}).status_code == 422
