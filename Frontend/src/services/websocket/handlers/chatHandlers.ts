// Frontend/src/services/websocket/handlers/chatHandlers.ts

import { useEffect } from 'react';
import { websocketService } from '../websocket';
import type { Participant } from '../../../types/Room';
import type { WebSocketMessage } from '../websocket';

export interface ChatMessage {
  id: string;
  sender: Participant;
  content: string;
  timestamp: Date;
}

interface ChatHandlersConfig {
  participants: Participant[];
  onMessage: (message: ChatMessage) => void;
}

/**
 * Hook to register chat-related WebSocket handlers
 */
export function useChatHandlers({ participants, onMessage }: ChatHandlersConfig) {
  useEffect(() => {
    const unsubscribe = websocketService.on('chat_message', (message: WebSocketMessage) => {
      if (!message.data) return;

      const sender = participants.find(p => p.id === message.data.sender_id) || {
        id: message.data.sender_id,
        name: message.data.sender_name || 'Unknown',
        avatar: message.data.sender_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Unknown',
        voiceEnabled: true,
        videoEnabled: true,
        isSpeaking: false,
        isConnected: true,
      };

      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender,
        content: message.data.content,
        timestamp: new Date(),
      };

      onMessage(chatMessage);
    });

    return unsubscribe;
  }, [participants, onMessage]);
}