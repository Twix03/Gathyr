import { useCallback, useEffect, useState } from 'react';
import { LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { toast } from 'sonner';
import { useMediaRoom } from './livekit';
import { savePref } from '../lib/prefs';

function explain(e: unknown, what: string): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return `Gathyr doesn't have permission to use your ${what}. Allow it in your browser's site settings.`;
  if (name === 'NotFoundError') return `No ${what} found.`;
  if (name === 'NotReadableError') return `Your ${what} is being used by another app.`;
  return `Couldn't turn on your ${what}.`;
}

export function useMediaControls() {
  const room = useMediaRoom();
  const lp = room.localParticipant;
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = () => Room.getLocalDevices('videoinput', false).then(setCameras).catch(() => setCameras([]));
    load();
    room.on(RoomEvent.MediaDevicesChanged, load);
    return () => { room.off(RoomEvent.MediaDevicesChanged, load); };
  }, [room]);

  const run = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }, [busy]);

  const toggleMic = () => run('mic', async () => {
    const next = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(next);
      savePref('micOn', next);
    } catch (e) { toast.error(explain(e, 'microphone')); }
  });

  const toggleCamera = () => run('camera', async () => {
    const next = !lp.isCameraEnabled;
    try {
      await lp.setCameraEnabled(next);
      savePref('cameraOn', next);
    } catch (e) { toast.error(explain(e, 'camera')); }
  });

  const toggleScreenShare = () => run('screen', async () => {
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, {
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        contentHint: 'detail',
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
      });
    } catch (e) {
      if ((e as { name?: string })?.name !== 'NotAllowedError') toast.error("Couldn't share your screen.");
    }
  });

  /** Front ⇄ back camera on phones; cycles cameras on desktops with several. */
  const flipCamera = () => run('flip', async () => {
    const pub = lp.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track) return;
    const current = track.mediaStreamTrack.getSettings().facingMode;
    try {
      if (current) {
        await track.restartTrack({ facingMode: current === 'user' ? 'environment' : 'user' });
      } else if (cameras.length > 1) {
        const id = track.mediaStreamTrack.getSettings().deviceId;
        const idx = cameras.findIndex((c) => c.deviceId === id);
        await room.switchActiveDevice('videoinput', cameras[(idx + 1) % cameras.length].deviceId);
      }
    } catch { toast.error("Couldn't switch camera."); }
  });

  return {
    toggleMic, toggleCamera, toggleScreenShare, flipCamera,
    canFlip: cameras.length > 1,
    canScreenShare: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    busy,
  };
}
