import { memo, useEffect, useRef } from 'react';
import { ConnectionQuality, type Track } from 'livekit-client';
import { Maximize2, MicOff, Monitor, Pin, PinOff, VolumeX, WifiOff } from 'lucide-react';
import type { MediaParticipant } from '../media/useMediaParticipants';
import { Avatar } from '../ui/Avatar';
import { cn } from '../ui/cn';
import { toggleLocalMute, usePrefs } from '../lib/prefs';

export interface TileData {
  key: string;
  participant: MediaParticipant;
  kind: 'camera' | 'screen';
  color?: number;
}

export function tilesFor(participants: MediaParticipant[], colors: Map<string, number>): TileData[] {
  const screens: TileData[] = [];
  const cams: TileData[] = [];
  for (const p of participants) {
    const color = colors.get(p.identity);
    if (p.screen) screens.push({ key: `${p.identity}:screen`, participant: p, kind: 'screen', color });
    cams.push({ key: `${p.identity}:camera`, participant: p, kind: 'camera', color });
  }
  return [...screens, ...cams];
}

interface Props {
  tile: TileData;
  className?: string;
  compact?: boolean;
  pinned?: boolean;
  onPin?: () => void;
}

/**
 * The <video> element stays mounted for as long as a track exists and is just hidden
 * while the camera is off. Unmounting it on mute (the old behaviour) meant a fresh
 * element sometimes never got the track attached — "video doesn't show until I switch pages".
 */
export const VideoTile = memo(function VideoTile({ tile, className, compact, pinned, onPin }: Props) {
  const { participant: p, kind } = tile;
  const track: Track | undefined = kind === 'screen' ? p.screen : p.camera;
  const showVideo = kind === 'screen' ? !!track : p.cameraEnabled;
  const ref = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { mutedIdentities } = usePrefs();
  const locallyMuted = mutedIdentities.has(p.identity);

  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  const fullscreen = () => {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const label = `${p.name}${p.isLocal ? ' (you)' : ''}${kind === 'screen' ? ' — screen' : ''}`;
  const poor = p.quality === ConnectionQuality.Poor || p.quality === ConnectionQuality.Lost;

  return (
    <div
      ref={boxRef}
      onDoubleClick={fullscreen}
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-tile)] bg-raised isolate',
        'ring-2 ring-transparent transition-[box-shadow,ring-color] duration-150',
        kind === 'camera' && p.isSpeaking && 'ring-accent',
        className,
      )}
    >
      {track && (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={cn(
            'absolute inset-0 size-full',
            kind === 'screen' ? 'object-contain bg-black' : 'object-cover',
            p.isLocal && kind === 'camera' && '-scale-x-100',
            !showVideo && 'invisible',
          )}
        />
      )}

      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={p.name} color={tile.color} size={compact ? 40 : 72} />
        </div>
      )}

      {/* name + state */}
      <div className="absolute left-2 bottom-2 right-2 flex items-center gap-1.5 pointer-events-none">
        <span className={cn('flex items-center gap-1.5 max-w-full rounded-md bg-black/55 px-2 py-1',
          compact ? 'text-[11px]' : 'text-xs', 'font-medium text-white backdrop-blur-sm')}>
          {kind === 'screen' && <Monitor size={12} className="shrink-0" />}
          {kind === 'camera' && !p.micEnabled && <MicOff size={12} className="shrink-0 text-bad" />}
          {locallyMuted && <VolumeX size={12} className="shrink-0 text-warn" />}
          {poor && <WifiOff size={12} className="shrink-0 text-warn" />}
          <span className="truncate">{label}</span>
        </span>
      </div>

      {/* hover actions */}
      {!compact && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {!p.isLocal && kind === 'camera' && (
            <TileAction label={locallyMuted ? 'Unmute for me' : 'Mute for me'} onClick={() => toggleLocalMute(p.identity)}>
              <VolumeX size={14} />
            </TileAction>
          )}
          {onPin && (
            <TileAction label={pinned ? 'Unpin' : 'Pin'} onClick={onPin}>
              {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </TileAction>
          )}
          <TileAction label="Full screen" onClick={fullscreen}><Maximize2 size={14} /></TileAction>
        </div>
      )}
    </div>
  );
});

function TileAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="size-8 inline-flex items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
    >
      {children}
    </button>
  );
}
