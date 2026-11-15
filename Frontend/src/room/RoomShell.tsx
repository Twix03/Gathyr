import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { toast } from 'sonner';
import {
  Camera, CameraOff, Copy, Gamepad2, LogOut, MessageSquare, Mic, MicOff, MonitorUp,
  MoreHorizontal, PictureInPicture2, Settings, SwitchCamera, Users, Volume2, WifiOff, X, Bug,
} from 'lucide-react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { useParticipantMap, useRoom, useRoomStore } from '../lib/roomStore';
import { useMediaRoom } from '../media/livekit';
import { useMediaParticipants } from '../media/useMediaParticipants';
import { AudioRenderer, useAudioPlaybackBlocked } from '../media/AudioRenderer';
import { useMediaControls } from '../media/useMediaControls';
import { usePrefs } from '../lib/prefs';
import { Stage } from './Stage';
import { ChatPanel } from './ChatPanel';
import { PeoplePanel } from './PeoplePanel';
import { GameLibrary } from './GameLibrary';
import { VoteCard } from './VoteCard';
import { SettingsDialog } from './SettingsDialog';
import { FeedbackDialog } from './FeedbackDialog';
import { usePiP } from './usePiP';
import { parseModeration } from './moderation';
import { GameHost } from '../games/GameHost';
import { IconButton, Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { Wordmark } from '../ui/Wordmark';

type Panel = 'chat' | 'people' | null;

export function RoomShell({ onLeave }: { onLeave: () => void }) {
  const store = useRoomStore();
  const lk = useMediaRoom();
  const room = useRoom((s) => s.room);
  const me = useRoom((s) => s.me);
  const status = useRoom((s) => s.status);
  const people = useParticipantMap();
  const media = useMediaParticipants();
  const prefs = usePrefs();
  const controls = useMediaControls();
  const [audioBlocked, startAudio] = useAudioPlaybackBlocked();
  const pip = usePiP(prefs.autoPiP);

  const [panel, setPanel] = useState<Panel>(null);
  const [library, setLibrary] = useState(false);
  const [settings, setSettings] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const colors = useMemo(() => new Map(room.participants.map((p) => [p.id, p.color])), [room.participants]);
  // Only show media for people who are actually in the room
  const visibleMedia = useMemo(() => media.filter((m) => people.has(m.identity)), [media, people]);
  const local = media.find((m) => m.isLocal);

  // --- chat notifications
  useEffect(() => store.onChat((m) => {
    if (m.sender_id === me) return;
    if (panel !== 'chat') {
      setUnread((n) => n + 1);
      toast(m.sender_name, { description: m.text.slice(0, 120), id: 'chat', duration: 3500 });
    }
  }), [store, me, panel]);
  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);

  // --- server errors & vote outcomes
  const lastError = useRoom((s) => s.lastError);
  useEffect(() => { if (lastError) toast.error(lastError.message); }, [lastError]);
  const result = useRoom((s) => s.lastProposalResult);
  useEffect(() => {
    if (result && !result.passed) toast(result.type === 'START' ? 'Not enough votes to start.' : 'The game goes on.');
  }, [result]);

  // --- host moderation (LiveKit authenticates the sender identity)
  const hostId = room.host_id;
  useEffect(() => {
    const onData = (payload: Uint8Array, from?: RemoteParticipant) => {
      const msg = parseModeration(payload);
      if (!msg || msg.target !== lk.localParticipant.identity || from?.identity !== hostId) return;
      void lk.localParticipant.setMicrophoneEnabled(false);
      toast('The host muted you.', { description: 'You can unmute yourself any time.' });
    };
    lk.on(RoomEvent.DataReceived, onData);
    return () => { lk.off(RoomEvent.DataReceived, onData); };
  }, [lk, hostId]);

  const invite = async () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Join me on Gathyr', url });
      else { await navigator.clipboard.writeText(url); toast.success('Invite link copied'); }
    } catch { /* cancelled */ }
  };

  const game = room.game;
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const online = room.participants.filter((p) => p.connected).length;

  return (
    <div className="flex h-dvh flex-col bg-ink">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3 md:px-4">
        <Wordmark className="hidden sm:block" />
        <button type="button" onClick={invite} title="Copy invite link"
          className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-raised">
          <span className="font-mono text-sm tracking-[0.2em]">{room.code}</span>
          <Copy size={14} className="text-muted group-hover:text-text" />
        </button>
        {game && (
          <div className="ml-1 hidden md:flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1 text-sm">
            <Gamepad2 size={14} className="text-accent" />
            <span className="font-medium">{game.name}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {status !== 'open' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn">
              <WifiOff size={13} /> Reconnecting…
            </span>
          )}
          {game && !game.finished && (
            <Button size="sm" variant="secondary" disabled={!!room.proposal}
              onClick={() => store.send('propose', { type: 'END' })}>
              End game
            </Button>
          )}
          <span className="hidden sm:inline text-sm text-muted tabular">{online} here</span>
        </div>
      </header>

      {audioBlocked && (
        <button type="button" onClick={startAudio}
          className="flex items-center justify-center gap-2 bg-accent py-2 text-sm font-semibold text-accent-ink">
          <Volume2 size={16} /> Your browser paused audio — tap to hear everyone
        </button>
      )}

      {/* main */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {game ? (
            <GameHost participants={visibleMedia} colors={colors} />
          ) : (
            <Stage participants={visibleMedia} colors={colors} layout={prefs.layout} pinned={pinned} onPin={setPinned} />
          )}
          {!game && online === 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-panel/95 px-4 py-3 shadow-pop">
                <span className="text-sm text-muted">It's just you. Invite friends with code <b className="font-mono text-text">{room.code}</b></span>
                <Button size="sm" variant="primary" onClick={invite}>Invite</Button>
              </div>
            </div>
          )}
        </main>

        {panel && (
          <aside className="fixed inset-0 z-30 flex flex-col bg-panel md:static md:z-auto md:w-80 md:border-l md:border-line">
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2">
              {(['chat', 'people'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPanel(p)}
                  className={cn('h-8 rounded-lg px-3 text-sm capitalize', panel === p ? 'bg-raised font-semibold' : 'text-muted hover:text-text')}>
                  {p === 'people' ? `People · ${room.participants.length}` : 'Chat'}
                </button>
              ))}
              <button type="button" aria-label="Close panel" onClick={() => setPanel(null)}
                className="ml-auto size-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">{panel === 'chat' ? <ChatPanel /> : <PeoplePanel media={media} />}</div>
          </aside>
        )}
      </div>

      {/* control bar */}
      <footer className="flex h-[72px] shrink-0 items-center justify-center gap-2 border-t border-line px-3 pb-[env(safe-area-inset-bottom)]">
        <IconButton label={local?.micEnabled ? 'Mute' : 'Unmute'} tone={local?.micEnabled ? 'default' : 'off'}
          onClick={controls.toggleMic} disabled={controls.busy === 'mic'}>
          {local?.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </IconButton>
        <IconButton label={local?.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          tone={local?.cameraEnabled ? 'default' : 'off'} onClick={controls.toggleCamera} disabled={controls.busy === 'camera'}>
          {local?.cameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
        </IconButton>
        {controls.canFlip && local?.cameraEnabled && (
          <IconButton label="Switch camera" onClick={controls.flipCamera} className="md:hidden">
            <SwitchCamera size={20} />
          </IconButton>
        )}
        {controls.canScreenShare && (
          <IconButton label={local?.screen ? 'Stop sharing' : 'Share screen'} active={!!local?.screen}
            onClick={controls.toggleScreenShare} className="hidden md:inline-flex">
            <MonitorUp size={20} />
          </IconButton>
        )}
        <div className="mx-1 h-6 w-px bg-line" />
        <IconButton label="Games" tone={game ? 'default' : 'accent'} disabled={!!game} onClick={() => setLibrary(true)}>
          <Gamepad2 size={20} />
        </IconButton>
        <IconButton label="Chat" active={panel === 'chat'} badge={unread} onClick={() => togglePanel('chat')}>
          <MessageSquare size={20} />
        </IconButton>
        <IconButton label="People" active={panel === 'people'} onClick={() => togglePanel('people')} className="hidden sm:inline-flex">
          <Users size={20} />
        </IconButton>
        <DM.Root>
          <DM.Trigger asChild>
            <IconButton label="More"><MoreHorizontal size={20} /></IconButton>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content side="top" align="end" sideOffset={10}
              className="z-50 min-w-52 rounded-xl border border-line bg-panel p-1 shadow-pop animate-pop-in">
              <MenuItem onSelect={invite} icon={<Copy size={16} />}>Copy invite link</MenuItem>
              <MenuItem onSelect={() => setPanel('people')} icon={<Users size={16} />} className="sm:hidden">People</MenuItem>
              {pip.supported && (
                <MenuItem onSelect={() => (pip.isOpen ? pip.close() : void pip.open())} icon={<PictureInPicture2 size={16} />}>
                  {pip.isOpen ? 'Close pop-out' : 'Pop out videos'}
                </MenuItem>
              )}
              <MenuItem onSelect={() => setSettings(true)} icon={<Settings size={16} />}>Settings</MenuItem>
              <MenuItem onSelect={() => setFeedback(true)} icon={<Bug size={16} />}>Send feedback</MenuItem>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
        <IconButton label="Leave room" tone="danger" onClick={onLeave} className="ml-1 w-14">
          <LogOut size={20} />
        </IconButton>
      </footer>

      <VoteCard />
      <AudioRenderer participants={media} />
      <GameLibrary open={library} onOpenChange={setLibrary} />
      <SettingsDialog open={settings} onOpenChange={setSettings} pipSupported={pip.supported} />
      <FeedbackDialog open={feedback} onOpenChange={setFeedback} roomCode={room.code} />
      {pip.pipWindow && createPortal(
        <div className="h-full p-1.5 bg-ink">
          <Stage participants={visibleMedia} colors={colors} layout="grid" pinned={null} onPin={() => {}} />
        </div>,
        pip.pipWindow.document.body,
      )}
    </div>
  );
}

function MenuItem({ onSelect, icon, children, className }: {
  onSelect: () => void; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <DM.Item onSelect={onSelect}
      className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-raised', className)}>
      <span className="text-muted">{icon}</span>{children}
    </DM.Item>
  );
}
