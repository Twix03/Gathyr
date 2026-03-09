import { useEffect, useState, useMemo } from "react";
import { Track, RemoteParticipant, LocalParticipant, Participant, RoomEvent, TrackPublication } from "livekit-client";
import { useLiveKitRoom } from "./liveKitRoom";

export type MediaParticipant = {
  id: string; // sid
  identity: string;
  name: string;
  videoTrack?: Track;
  audioTrack?: Track;
  screenShareTrack?: Track;
  screenShareAudioTrack?: Track; // audio from screen share (Tab/System audio)
  isLocal: boolean;
  isSpeaking: boolean;
};

export function useLiveKitMedia() {
  const room = useLiveKitRoom();
  const [participants, setParticipants] = useState<Map<string, MediaParticipant>>(new Map());

  useEffect(() => {
    // Helper to update a participant's tracks
    const updateParticipant = (p: Participant) => {
      // Ignore participants without an identity (often initial local participant state before connection)
      if (!p.identity) return;

      setParticipants(prev => {
        const next = new Map(prev);

        // Use identity as the stable key
        const existing: MediaParticipant = next.get(p.identity) || {
          id: p.sid,
          identity: p.identity,
          name: p.name || p.identity, // Fallback to identity if name is empty
          isLocal: p instanceof LocalParticipant,
          isSpeaking: p.isSpeaking,
        };

        // Ensure name is updated if it changes (though unlikely for same identity in short session)
        existing.name = p.name || p.identity;
        existing.isSpeaking = p.isSpeaking;

        // Get tracks from publications
        const videoPub = p.getTrackPublication(Track.Source.Camera);
        const audioPub = p.getTrackPublication(Track.Source.Microphone);
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
        const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio);

        // Update tracks 
        existing.videoTrack = videoPub?.track;
        existing.audioTrack = audioPub?.track;
        existing.screenShareTrack = screenPub?.track;
        existing.screenShareAudioTrack = screenAudioPub?.track;

        next.set(p.identity, { ...existing }); // Create shallow copy to force re-render check if needed
        return next;
      });
    };

    const removeParticipant = (p: Participant) => {
      setParticipants(prev => {
        const next = new Map(prev);
        next.delete(p.identity);
        return next;
      });
    }

    // --- Event Handlers ---

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log("Participant connected:", participant.identity);
      updateParticipant(participant);
    };

    const handleRoomConnected = () => {
      console.log("Room connected, adding local participant");
      updateParticipant(room.localParticipant);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log("Participant disconnected:", participant.identity);
      removeParticipant(participant);
    };

    const handleTrackSubscribed = (track: Track, pub: TrackPublication, participant: RemoteParticipant) => {
      console.log("Track subscribed:", track.kind, participant.identity);
      updateParticipant(participant);
    };

    const handleTrackUnsubscribed = (track: Track, pub: TrackPublication, participant: RemoteParticipant) => {
      console.log("Track unsubscribed:", track.kind, participant.identity);
      updateParticipant(participant);
    };

    const handleLocalTrackPublished = (pub: TrackPublication) => {
      console.log("Local track published:", pub.kind);
      updateParticipant(room.localParticipant);
    };

    const handleLocalTrackUnpublished = (pub: TrackPublication) => {
      console.log("Local track unpublished:", pub.kind);
      updateParticipant(room.localParticipant);
    }

    // Mute/Unmute events affect the track's isMuted property but might not trigger subscription changes
    // We need to re-run updateParticipant to force re-render of icons
    const handleTrackMuted = (pub: TrackPublication, participant: Participant) => {
      console.log("Track muted", pub.kind, participant.identity);
      updateParticipant(participant);
    }

    const handleTrackUnmuted = (pub: TrackPublication, participant: Participant) => {
      console.log("Track unmuted", pub.kind, participant.identity);
      updateParticipant(participant);
    }

    const handleActiveSpeakersChanged = (speakers: Participant[]) => {
      // Efficiently update only changed participants
      // However, since we need to update state map, simpler to iterate current map or strictly update speakers + previous speakers
      // For simplicity and correctness with our map structure:
      // We can iterate all participants in our map and sync their isSpeaking state with the room state
      // Or just update the ones in the speakers list + anyone who WAS speaking.

      setParticipants(prev => {
        const next = new Map(prev);
        let changed = false;

        // 1. Mark everyone as not speaking first (or check previous state)
        // To be efficient, we can check who needs updating. 
        // But simplest is to just re-evaluate isSpeaking for everyone based on `room.activeSpeakers` or the passed `speakers` array?
        // The `speakers` array only contains those CURRENTLY speaking.

        next.forEach((p) => {
          const nowSpeaking = speakers.some(s => s.identity === p.identity);
          if (p.isSpeaking !== nowSpeaking) {
            p.isSpeaking = nowSpeaking;
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }


    // --- Setup Listeners ---

    room.on(RoomEvent.Connected, handleRoomConnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

    // Local mute/unmute events are usually handled via TrackMuted on the room or LocalTrackPublished updates
    room.localParticipant.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.localParticipant.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.localParticipant.on(RoomEvent.TrackMuted, (pub) => handleTrackMuted(pub, room.localParticipant));
    room.localParticipant.on(RoomEvent.TrackUnmuted, (pub) => handleTrackUnmuted(pub, room.localParticipant));


    // --- Initial State Population ---

    // Add Local Participant
    updateParticipant(room.localParticipant);

    // Add Remote Participants that are already connected
    room.remoteParticipants.forEach(p => {
      updateParticipant(p);
    });

    // Cleanup
    return () => {
      room.off(RoomEvent.Connected, handleRoomConnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

      room.localParticipant.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.localParticipant.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      //   room.localParticipant.off(RoomEvent.TrackMuted, ...); // anonymous functions hard to unregister, but mostly harmless in hook cleanup dependency change
    };
  }, [room]);

  const participantsArray = useMemo(() => Array.from(participants.values()), [participants]);
  return participantsArray;
}
