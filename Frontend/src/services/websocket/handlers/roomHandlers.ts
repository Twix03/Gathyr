// Frontend/src/services/websocket/handlers/roomHandlers.ts

import { useEffect } from 'react';
import { websocketService } from '../websocket';
import type { Room, Participant } from '../../../types/Room';
import type { WebSocketMessage } from '../websocket';

interface RoomHandlersConfig {
  setRoom: (room: Room | null | ((prev: Room | null) => Room | null)) => void;
  setUser: (user: Participant | null | ((prev: Participant | null) => Participant | null)) => void;
  currentUserId: string;
}

/**
 * Transform backend participant format to frontend format
 */
function transformParticipant(p: any): Participant {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    voiceEnabled: p.voice_enabled ?? p.voiceEnabled ?? true,
    isSpeaking: p.is_speaking ?? p.isSpeaking ?? false,
    videoEnabled: p.video_enabled ?? p.videoEnabled ?? true,
    isConnected: p.is_connected ?? p.isConnected ?? true,
  };
}

/**
 * Hook to register all room-related WebSocket handlers
 */
export function useRoomHandlers({ setRoom, setUser, currentUserId }: RoomHandlersConfig) {
  useEffect(() => {
    // Room state handler - initial state on connect
    const unsubRoomState = websocketService.on('room_state', (message: WebSocketMessage) => {
      console.log('Room state received');
      const room = message.data?.room;
      if (!room) return;

      setRoom({
        id: room.id,
        code: room.code,
        participants: (room.participants || []).map(transformParticipant),
        currentGame: room.current_game ?? null,
        lastPlayed: room.last_played ?? null,
        proposal: room.proposal ?? null,
      });
    });

    // Participant joined handler
    const unsubJoined = websocketService.on('participant_joined', (message: WebSocketMessage) => {
      console.log('Participant joined');
      const participant = message.data?.participant;
      if (!participant) return;

      const transformedParticipant = transformParticipant(participant);

      setRoom((prev) => {
        if (!prev) return prev;
        
        // Check if participant already exists
        if (prev.participants.some(p => p.id === transformedParticipant.id)) {
          return prev;
        }

        return {
          ...prev,
          participants: [...prev.participants, transformedParticipant],
        };
      });
    });

    // Participant left handler
    const unsubLeft = websocketService.on('participant_left', (message: WebSocketMessage) => {
      console.log('Participant left');
      const participantId = message.data?.participant_id;
      if (!participantId) return;

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.filter(p => p.id !== participantId),
        };
      });
    });

    // Participant disconnected handler
    const unsubDisconnected = websocketService.on('participant_disconnected', (message: WebSocketMessage) => {
      console.log('Participant disconnected');
      const participantId = message.data?.participant_id;
      if (!participantId) return;

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.id === participantId ? { ...p, isConnected: false } : p
          ),
        };
      });
    });

    // Participant updated handler
    const unsubUpdated = websocketService.on('participant_updated', (message: WebSocketMessage) => {
      console.log('Participant updated');
      const participant = message.data?.participant;
      if (!participant) return;

      const transformedParticipant = transformParticipant(participant);

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.id === transformedParticipant.id ? transformedParticipant : p
          ),
        };
      });

      // Update current user if it's them
      if (transformedParticipant.id === currentUserId) {
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            voiceEnabled: transformedParticipant.voiceEnabled,
            isSpeaking: transformedParticipant.isSpeaking,
            videoEnabled: transformedParticipant.videoEnabled,
          };
        });
      }
    });

    // Cleanup function
    return () => {
      unsubRoomState();
      unsubJoined();
      unsubLeft();
      unsubDisconnected();
      unsubUpdated();
    };
  }, [setRoom, setUser, currentUserId]);
}