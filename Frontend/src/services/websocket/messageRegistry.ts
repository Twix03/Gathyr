// Frontend/src/services/websocket/messageRegistry.ts

/**
 * WebSocket Message Registry
 * Centralized message type definitions with categories
 */

export type MessageCategory = 'room' | 'game' | 'proposal' | 'chat' | 'error';

export type MessageDirection = 'client_to_server' | 'server_to_client' | 'bidirectional';

export interface MessageDefinition {
  type: string;
  category: MessageCategory;
  direction: MessageDirection;
}

// Room Messages
export const ROOM_MESSAGES = {
  ROOM_STATE: {
    type: 'room_state',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_JOINED: {
    type: 'participant_joined',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_LEFT: {
    type: 'participant_left',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_CONNECTED: {
    type: 'participant_connected',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_DISCONNECTED: {
    type: 'participant_disconnected',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_UPDATED: {
    type: 'participant_updated',
    category: 'room' as const,
    direction: 'server_to_client' as const,
  },
  PARTICIPANT_UPDATE: {
    type: 'participant_update',
    category: 'room' as const,
    direction: 'client_to_server' as const,
  },
} as const;

// Game Messages
export const GAME_MESSAGES = {
  GAME_STARTED: {
    type: 'game_started',
    category: 'game' as const,
    direction: 'server_to_client' as const,
  },
  GAME_ENDED: {
    type: 'game_ended',
    category: 'game' as const,
    direction: 'server_to_client' as const,
  },
  GAME_STATE_UPDATED: {
    type: 'game_state_updated',
    category: 'game' as const,
    direction: 'server_to_client' as const,
  },
  GAME_STATE_UPDATE: {
    type: 'game_state_update',
    category: 'game' as const,
    direction: 'client_to_server' as const,
  },
  GAME_START: {
    type: 'game_start',
    category: 'game' as const,
    direction: 'client_to_server' as const,
  },
  TIMER_STARTED: {
    type: 'timer_started',
    category: 'game' as const,
    direction: 'server_to_client' as const,
  },
  TIMER_ENDED: {
    type: 'timer_ended',
    category: 'game' as const,
    direction: 'server_to_client' as const,
  },
} as const;

// Proposal Messages
export const PROPOSAL_MESSAGES = {
  PROPOSAL_CREATED: {
    type: 'proposal_created',
    category: 'proposal' as const,
    direction: 'server_to_client' as const,
  },
  PROPOSAL_UPDATED: {
    type: 'proposal_updated',
    category: 'proposal' as const,
    direction: 'server_to_client' as const,
  },
  PROPOSAL_FAILED: {
    type: 'proposal_failed',
    category: 'proposal' as const,
    direction: 'server_to_client' as const,
  },
  PROPOSE_GAME: {
    type: 'propose_game',
    category: 'proposal' as const,
    direction: 'client_to_server' as const,
  },
  VOTE_GAME: {
    type: 'vote_game',
    category: 'proposal' as const,
    direction: 'client_to_server' as const,
  },
  FINALIZE_PROPOSAL: {
    type: 'finalize_proposal',
    category: 'proposal' as const,
    direction: 'client_to_server' as const,
  },
} as const;

// Chat Messages
export const CHAT_MESSAGES = {
  CHAT_MESSAGE: {
    type: 'chat_message',
    category: 'chat' as const,
    direction: 'bidirectional' as const,
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  ERROR: {
    type: 'error',
    category: 'error' as const,
    direction: 'server_to_client' as const,
  },
} as const;

// All messages combined
export const ALL_MESSAGES = {
  ...ROOM_MESSAGES,
  ...GAME_MESSAGES,
  ...PROPOSAL_MESSAGES,
  ...CHAT_MESSAGES,
  ...ERROR_MESSAGES,
} as const;

// Extract message types
export type WebSocketMessageType = typeof ALL_MESSAGES[keyof typeof ALL_MESSAGES]['type'];

// Type guard to check if message type is valid
export function isValidMessageType(type: string): type is WebSocketMessageType {
  return Object.values(ALL_MESSAGES).some(msg => msg.type === type);
}

// Get message definition by type
export function getMessageDefinition(type: string): MessageDefinition | undefined {
  return Object.values(ALL_MESSAGES).find(msg => msg.type === type);
}