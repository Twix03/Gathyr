import { Crown, MicOff, UserMinus, VolumeX } from 'lucide-react';
import { useRoom, useRoomStore } from '../lib/roomStore';
import { useMediaRoom } from '../media/livekit';
import type { MediaParticipant } from '../media/useMediaParticipants';
import { Avatar } from '../ui/Avatar';
import { toggleLocalMute, usePrefs } from '../lib/prefs';
import { sendModeration } from './moderation';
import { cn } from '../ui/cn';

export function PeoplePanel({ media }: { media: MediaParticipant[] }) {
  const store = useRoomStore();
  const room = useRoom((s) => s.room);
  const me = useRoom((s) => s.me);
  const lk = useMediaRoom();
  const { mutedIdentities } = usePrefs();
  const isHost = room.host_id === me;
  const mediaById = new Map(media.map((m) => [m.identity, m]));

  return (
    <div className="h-full overflow-y-auto p-2">
      {room.participants.map((p) => {
        const m = mediaById.get(p.id);
        const self = p.id === me;
        return (
          <div key={p.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-raised">
            <Avatar name={p.name} color={p.color} size={32} dimmed={!p.connected} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('truncate text-sm font-medium', !p.connected && 'text-muted')}>
                  {p.name}{self && ' (you)'}
                </span>
                {room.host_id === p.id && <Crown size={13} className="shrink-0 text-warn" aria-label="Host" />}
              </div>
              <div className="text-xs text-muted">
                {!p.connected ? 'Reconnecting…' : m?.isSpeaking ? 'Speaking' : m && !m.micEnabled ? 'Muted' : 'In the room'}
              </div>
            </div>
            {!self && p.connected && (
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                <PanelAction label={mutedIdentities.has(p.id) ? 'Unmute for me' : 'Mute for me'}
                  active={mutedIdentities.has(p.id)} onClick={() => toggleLocalMute(p.id)}>
                  <VolumeX size={15} />
                </PanelAction>
                {isHost && m?.micEnabled && (
                  <PanelAction label="Mute for everyone" onClick={() => sendModeration(lk, p.id, 'mute')}>
                    <MicOff size={15} />
                  </PanelAction>
                )}
                {isHost && (
                  <PanelAction label="Remove from room" danger
                    onClick={() => { if (confirm(`Remove ${p.name} from the room?`)) store.send('kick', { participant_id: p.id }); }}>
                    <UserMinus size={15} />
                  </PanelAction>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PanelAction({ label, onClick, children, active, danger }: {
  label: string; onClick: () => void; children: React.ReactNode; active?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn('size-8 inline-flex items-center justify-center rounded-lg hover:bg-hover',
        active ? 'text-warn' : danger ? 'text-muted hover:text-bad' : 'text-muted hover:text-text')}>
      {children}
    </button>
  );
}
