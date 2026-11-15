import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api, type RoomPreview } from '../lib/api';
import { lastUsedName, loadSession, saveSession } from '../lib/session';
import type { SessionResponse } from '../lib/types';
import { GAMES } from '../games/catalog';
import { Button } from '../ui/Button';
import { Wordmark } from '../ui/Wordmark';
import { cn } from '../ui/cn';

const CODE_RE = /^[A-Z0-9]{6}$/;

export default function LandingRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invited = (params.get('room') ?? '').toUpperCase();
  const [mode, setMode] = useState<'create' | 'join'>(invited ? 'join' : 'create');
  const [name, setName] = useState(lastUsedName);
  const [code, setCode] = useState(invited);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If we already hold a seat in the invited room, go straight back in.
  useEffect(() => {
    if (invited && loadSession(invited)) navigate(`/rooms/${invited}`, { replace: true });
  }, [invited, navigate]);

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (mode !== 'join' || !CODE_RE.test(code)) return;
    let live = true;
    api.preview(code).then((p) => live && setPreview(p)).catch((e) => live && setPreviewError(e.message));
    return () => { live = false; };
  }, [mode, code]);

  const enter = (res: SessionResponse) => {
    saveSession({ code: res.room.code, token: res.session_token, participantId: res.participant.id, name: res.participant.name });
    navigate(`/rooms/${res.room.code}`, { state: { session: res } });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      enter(mode === 'create' ? await api.createRoom(name.trim()) : await api.joinRoom(code, name.trim()));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length > 0 && (mode === 'create' || (CODE_RE.test(code) && !previewError && !preview?.full));

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-5"><Wordmark className="text-xl" /></header>
      <main className="flex-1 grid items-center gap-12 px-6 pb-12 lg:grid-cols-[1.1fr_1fr] max-w-6xl w-full mx-auto">
        <section>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Game night,<br />on video.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Jump on a call and play drawing, trivia and party games together in your browser. No downloads, no accounts.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {GAMES.map((g) => (
              <li key={g.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted">
                <g.icon size={14} style={{ color: g.color }} /> {g.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md lg:justify-self-end rounded-2xl border border-line bg-panel p-6">
          <div className="inline-flex w-full rounded-xl bg-raised p-1 border border-line mb-6">
            {(['create', 'join'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                className={cn('h-9 flex-1 rounded-lg text-sm', mode === m ? 'bg-text text-ink font-semibold' : 'text-muted hover:text-text')}>
                {m === 'create' ? 'Start a room' : 'Join a room'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'join' && (
              <Field label="Room code">
                <input value={code} autoFocus={!code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC234" inputMode="text" autoCapitalize="characters" spellCheck={false}
                  className="input font-mono tracking-[0.3em] uppercase" />
                {preview && (
                  <p className="mt-2 text-sm text-muted">
                    {preview.full ? 'This room is full.' : preview.participant_count === 0 ? 'Nobody is here yet.'
                      : `${preview.names.join(', ')}${preview.participant_count > preview.names.length ? ' and others' : ''} ${preview.participant_count === 1 ? 'is' : 'are'} here`}
                    {preview.game && ` · playing ${preview.game}`}
                  </p>
                )}
                {previewError && <p className="mt-2 text-sm text-bad">{previewError}</p>}
              </Field>
            )}
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
                autoFocus={mode === 'create' || !!code} placeholder="What should we call you?" autoComplete="nickname"
                className="input" />
            </Field>
            {error && <p className="text-sm text-bad">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!canSubmit || busy}>
              {busy ? 'One sec…' : mode === 'create' ? 'Start a room' : 'Join'} {!busy && <ArrowRight size={18} />}
            </Button>
            <p className="text-xs text-faint text-center">You'll be asked for camera and microphone access.</p>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
