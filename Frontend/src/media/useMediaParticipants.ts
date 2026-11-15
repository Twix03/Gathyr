import { useEffect, useMemo, useState } from 'react';
import {
  ConnectionQuality, Participant, RoomEvent, Track, type Room,
} from 'livekit-client';
import { useMediaRoom } from './livekit';

export interface MediaParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  micEnabled: boolean;
  camera?: Track;
  cameraEnabled: boolean;
  screen?: Track;
  screenAudio?: Track;
  mic?: Track;
  quality: ConnectionQuality;
}

// Any of these can change what we render — instead of patching state per event
// (and inevitably missing one), we rebuild the whole snapshot from the Room.
const EVENTS: RoomEvent[] = [
  RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Disconnected,
  RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantNameChanged,
  RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
  RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackSubscriptionFailed,
  RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackStreamStateChanged,
  RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged, RoomEvent.ConnectionQualityChanged,
];

function describe(p: Participant, isLocal: boolean): MediaParticipant {
  const cam = p.getTrackPublication(Track.Source.Camera);
  const mic = p.getTrackPublication(Track.Source.Microphone);
  const screen = p.getTrackPublication(Track.Source.ScreenShare);
  const screenAudio = p.getTrackPublication(Track.Source.ScreenShareAudio);
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isLocal,
    isSpeaking: p.isSpeaking,
    micEnabled: !!mic && !mic.isMuted,
    mic: mic?.track,
    camera: cam?.track,
    cameraEnabled: !!cam?.track && !cam.isMuted,
    screen: screen?.track,
    screenAudio: screenAudio?.track,
    quality: p.connectionQuality,
  };
}

export function snapshot(room: Room): MediaParticipant[] {
  if (!room.localParticipant.identity) return [];
  return [
    describe(room.localParticipant, true),
    ...Array.from(room.remoteParticipants.values()).map((p) => describe(p, false)),
  ];
}

export function useMediaParticipants(): MediaParticipant[] {
  const room = useMediaRoom();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let frame = 0;
    // coalesce bursts of events (e.g. publish + subscribe + speaker change) into one render
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setVersion((v) => v + 1); });
    };
    EVENTS.forEach((e) => room.on(e, bump));
    bump();
    return () => {
      EVENTS.forEach((e) => room.off(e, bump));
      cancelAnimationFrame(frame);
    };
  }, [room]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => snapshot(room), [room, version]);
}
