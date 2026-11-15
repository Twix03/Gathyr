import { useEffect, useRef, useState } from 'react';
import { RoomEvent, type Track } from 'livekit-client';
import { useMediaRoom } from './livekit';
import type { MediaParticipant } from './useMediaParticipants';
import { usePrefs } from '../lib/prefs';

/**
 * All remote audio is played here, exactly once — independent of which video tiles
 * are visible. (Previously audio lived inside video tiles: hiding a tile muted the
 * person, and showing them twice played them twice.)
 */
export function AudioRenderer({ participants }: { participants: MediaParticipant[] }) {
  const { mutedIdentities } = usePrefs();
  return (
    <div hidden>
      {participants.filter((p) => !p.isLocal).flatMap((p) => [
        p.mic && <AudioTrack key={`${p.identity}-mic`} track={p.mic} muted={mutedIdentities.has(p.identity)} />,
        p.screenAudio && (
          <AudioTrack key={`${p.identity}-screen`} track={p.screenAudio}
            muted={mutedIdentities.has(`${p.identity}:screen`)} />
        ),
      ])}
    </div>
  );
}

function AudioTrack({ track, muted }: { track: Track; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);
  return <audio ref={ref} autoPlay muted={muted} />;
}

/** Browsers block audio until the user interacts; LiveKit tells us when that happens. */
export function useAudioPlaybackBlocked(): [boolean, () => void] {
  const room = useMediaRoom();
  const [blocked, setBlocked] = useState(!room.canPlaybackAudio);
  useEffect(() => {
    const update = () => setBlocked(!room.canPlaybackAudio);
    room.on(RoomEvent.AudioPlaybackStatusChanged, update);
    update();
    return () => { room.off(RoomEvent.AudioPlaybackStatusChanged, update); };
  }, [room]);
  return [blocked, () => { void room.startAudio(); }];
}
