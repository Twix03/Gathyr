/**
 * REST API service for room operations
 */
import { config } from './config';
import { Participant, Room } from '../types/Room';

export interface ParticipantCreate {
  name: string;
  avatar?: string;
}

export interface RoomCreateRequest {
  participant: ParticipantCreate;
}

export interface RoomJoinRequest {
  participant: ParticipantCreate;
  room_code: string;
}

export interface RoomCreateResponse {
  room: Room;
  participant: Participant;
  token: string;
}

export interface RoomJoinResponse {
  room: Room;
  participant: Participant;
  token: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  /**
   * Create a new room
   */
  async createRoom(participantData: ParticipantCreate): Promise<RoomCreateResponse> {
    const response = await fetch(`${this.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participant: {
          name: participantData.name,
          avatar: participantData.avatar || undefined,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create room' }));
      throw new Error(error.detail || 'Failed to create room');
    }

    const data = await response.json();

    // Transform backend response to frontend format
    return {
      room: {
        id: data.room.id,
        code: data.room.code,
        participants: data.room.participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          voiceEnabled: p.voice_enabled,
          isSpeaking: p.is_speaking,
          videoEnabled: p.video_enabled,
        })),
        currentGame: data.room.current_game,
        lastPlayed: data.room.last_played,
        proposal: null,
      },
      participant: {
        id: data.participant.id,
        name: data.participant.name,
        avatar: data.participant.avatar,
        voiceEnabled: data.participant.voice_enabled,
        isSpeaking: data.participant.is_speaking,
        videoEnabled: data.participant.video_enabled,
        isConnected: data.participant.is_connected,
      },
      token: data.token
    };
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomCode: string, participantData: ParticipantCreate): Promise<RoomJoinResponse> {
    const response = await fetch(`${this.baseUrl}/api/rooms/${roomCode.toUpperCase()}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participant: {
          name: participantData.name,
          avatar: participantData.avatar || undefined,
        },
        room_code: roomCode.toUpperCase(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to join room' }));
      throw new Error(error.detail || 'Failed to join room');
    }

    const data = await response.json();

    // Transform backend response to frontend format
    return {
      room: {
        id: data.room.id,
        code: data.room.code,
        participants: data.room.participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          voiceEnabled: p.voice_enabled,
          isSpeaking: p.is_speaking,
          videoEnabled: p.video_enabled,
        })),
        currentGame: data.room.current_game,
        lastPlayed: data.room.last_played,
        proposal: null,
      },
      participant: {
        id: data.participant.id,
        name: data.participant.name,
        avatar: data.participant.avatar,
        voiceEnabled: data.participant.voice_enabled,
        isSpeaking: data.participant.is_speaking,
        videoEnabled: data.participant.video_enabled,
        isConnected: data.participant.is_connected,
      },
      token: data.token
    };
  }

  /**
   * Get room information
   */
  async getRoom(roomCode: string): Promise<Room> {
    const response = await fetch(`${this.baseUrl}/api/rooms/${roomCode.toUpperCase()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Room not found' }));
      throw new Error(error.detail || 'Room not found');
    }

    const data = await response.json();

    // Transform backend response to frontend format
    return {
      id: data.id,
      code: data.code,
      participants: data.participants.map((p: any) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        voiceEnabled: p.voice_enabled,
        isSpeaking: p.is_speaking,
        videoEnabled: p.video_enabled,
      })),
      currentGame: data.current_game,
      lastPlayed: data.last_played,
      proposal: null,
    };
  }

  /**
   * Rejoin a room after page refresh using saved participant ID
   */
  async rejoinRoom(roomCode: string, participantId: string): Promise<RoomJoinResponse> {
    const response = await fetch(`${this.baseUrl}/api/rooms/${roomCode.toUpperCase()}/rejoin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to rejoin room' }));
      throw new Error(error.detail || 'Failed to rejoin room');
    }

    const data = await response.json();
    return {
      room: {
        id: data.room.id,
        code: data.room.code,
        participants: data.room.participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          voiceEnabled: p.voice_enabled,
          isSpeaking: p.is_speaking,
          videoEnabled: p.video_enabled,
        })),
        currentGame: data.room.current_game,
        lastPlayed: data.room.last_played,
        proposal: null,
      },
      participant: {
        id: data.participant.id,
        name: data.participant.name,
        avatar: data.participant.avatar,
        voiceEnabled: data.participant.voice_enabled,
        isSpeaking: data.participant.is_speaking,
        videoEnabled: data.participant.video_enabled,
        isConnected: data.participant.is_connected,
      },
      token: data.token,
    };
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomCode: string, participantId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/rooms/${roomCode.toUpperCase()}/participants/${participantId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({ detail: 'Failed to leave room' }));
      throw new Error(error.detail || 'Failed to leave room');
    }
    localStorage.clear();
  }
}

export const apiService = new ApiService();

