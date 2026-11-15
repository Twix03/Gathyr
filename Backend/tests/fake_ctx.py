"""A GameContext with manual timers, for testing game logic without a server."""


class FakeTimer:
    def __init__(self, ctx, delay, fn):
        self.ctx, self.delay, self.fn, self.cancelled = ctx, delay, fn, False

    def cancel(self):
        self.cancelled = True


class FakeCtx:
    def __init__(self, players):
        self.players = list(players)
        self.online = set(players)
        self.timers = []
        self.events = []      # (type, payload, to, exclude)
        self.ended = False
        self.dirty = False

    def player_ids(self):
        return [p for p in self.players if p in self.online]

    def name(self, pid):
        return pid.upper()

    def schedule(self, delay, fn):
        t = FakeTimer(self, delay, fn)
        self.timers.append(t)
        return t

    def changed(self):
        self.dirty = True

    def emit(self, type, payload=None, *, to=None, exclude=None):
        self.events.append((type, payload, to, exclude))

    def end(self):
        self.ended = True

    def fire(self):
        """Run the earliest pending timer."""
        pending = [t for t in self.timers if not t.cancelled]
        assert pending, "no timers pending"
        t = min(pending, key=lambda t: t.delay)
        self.timers.remove(t)
        t.fn()
        return t

    def fire_phase(self, game, phase_before):
        """Fire timers until the game leaves `phase_before`."""
        for _ in range(50):
            if game.phase != phase_before:
                return
            self.fire()
        raise AssertionError(f"stuck in {phase_before}")
