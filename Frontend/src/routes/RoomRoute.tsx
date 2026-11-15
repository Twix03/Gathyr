import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Room } from 'livekit-client';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { config } from '../lib/config';
import { getPrefs } from '../lib/prefs';
import { RealtimeClient } from '../lib/realtime';
import { RoomStore, RoomStoreContext } from '../lib/roomStore';
import { clearSession, loadSession, saveSession } from '../lib/session';
import type { SessionResponse } from '../lib/types';
import { createMediaRoom, MediaRoomContext } from '../media/livekit';
import { RoomShell } from '../room/RoomShell';
import { Button } from '../ui/Button';
import { Wordmark } from '../ui/Wordmark';

interface Joined {
  store: RoomStore;
  media: Room;
  token: string;
}

export default function RoomRoute() {
  const { roomCode = '' } = useParams();
  const code = roomCode.toUpperCase();
  const navigate = useNavigate();
  const location = useLocation();
  const [joined, setJoined] = useState<Joined | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let client: RealtimeClient | null = null;
    let media: Room | null = null;

    (async () => {
      let res: SessionResponse | null = (location.state as { session?: SessionResponse } | null)?.session ?? null;
      if (res && res.room.code !== code) res = null;
      const saved = loadSession(code);

      if (!res && saved) {
        try {
          res = await api.resume(code, saved.token);
        } catch (e) {
          const status = (e as ApiError).status;
          if (status === 401 && saved.name) {
            // seat expired (away too long) — take a new one with the same name
            try { res = await api.joinRoom(code, saved.name); } catch { res = null; }
          } else if (status !== 401 && status !== 404) {
            if (!cancelled) setError((e as Error).message);
            return;
          }
        }
      }
      if (cancelled) return;
      if (!res) {
        clearSession();
        navigate(`/?room=${code}`, { replace: true });
        return;
      }

      saveSession({ code, token: res.session_token, participantId: res.participant.id, name: res.participant.name });
      // drop the tokens from history state; a refresh goes through resume()
      if (location.state) navigate(location.pathname, { replace: true, state: null });

      const store = new RoomStore(res.participant.id, res.room);
      client = new RealtimeClient({
        url: `${config.wsBaseUrl}/ws/room/${code}`,
        token: res.session_token,
        onMessage: store.handle,
        onStatus: store.setStatus,
        onFatal: store.setFatal,
      });
      store.client = client;
      client.start();
      media = createMediaRoom();
      setJoined({ store, media, token: res.session_token });

      try {
        await media.connect(config.liveKitUrl, res.livekit_token);
      } catch {
        if (!cancelled) toast.error("Couldn't connect to video. Check your connection and refresh.");
        return;
      }
      if (cancelled) return;
      const prefs = getPrefs();
      await media.localParticipant.setMicrophoneEnabled(prefs.micOn).catch(() =>
        toast.error('Microphone unavailable', { description: 'Allow microphone access in your browser to talk.' }));
      await media.localParticipant.setCameraEnabled(prefs.cameraOn).catch(() =>
        toast.error('Camera unavailable', { description: 'Allow camera access in your browser to be seen.' }));
    })();

    return () => {
      cancelled = true;
      client?.stop();
      void media?.disconnect();
      setJoined(null);
    };
    // location.state is consumed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, attempt]);

  const leave = () => {
    if (joined) void api.leave(code, joined.token).catch(() => {});
    clearSession();
    navigate('/');
  };

  if (error) {
    return (
      <Notice title="Can't open this room" body={error}
        action={<Button variant="primary" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</Button>} />
    );
  }
  if (!joined) return <Notice title="Joining…" />;

  return (
    <RoomStoreContext.Provider value={joined.store}>
      <MediaRoomContext.Provider value={joined.media}>
        <FatalGate store={joined.store} onRetry={() => setAttempt((n) => n + 1)} onLeave={() => { clearSession(); navigate('/'); }}>
          <RoomShell onLeave={leave} />
        </FatalGate>
      </MediaRoomContext.Provider>
    </RoomStoreContext.Provider>
  );
}

function FatalGate({ store, onRetry, onLeave, children }: {
  store: RoomStore; onRetry: () => void; onLeave: () => void; children: React.ReactNode;
}) {
  const fatal = useSyncExternalStore(store.subscribe, () => store.getState().fatal);
  if (fatal === 'replaced') {
    return <Notice title="You're in this room in another tab"
      body="Gathyr only keeps one connection per person."
      action={<Button variant="primary" onClick={onRetry}>Use this tab instead</Button>} />;
  }
  if (fatal === 'kicked') {
    return <Notice title="You left the room" body="The host removed you, or your session ended."
      action={<Button variant="primary" onClick={onLeave}>Back to start</Button>} />;
  }
  if (fatal === 'invalid') {
    return <Notice title="Your session expired" body="Rejoin to get back in."
      action={<Button variant="primary" onClick={onRetry}>Rejoin</Button>} />;
  }
  return <>{children}</>;
}

export function Notice({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Wordmark className="mb-6 text-2xl" />
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
