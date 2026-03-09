// Frontend/src/services/websocket/websocket.ts

/**
 * WebSocket service for real-time communication
 */
import { config } from '../config';
import type { WebSocketMessageType } from './messageRegistry';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private roomCode: string | null = null;
  private participantId: string | null = null;
  private messageHandlers: Map<WebSocketMessageType, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: any | null = null;
  private isManualClose = false;

  /**
   * Connect to room WebSocket
   */
  connect(roomCode: string, participantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (this.roomCode === roomCode && this.participantId === participantId) {
          resolve();
          return;
        }
        this.disconnect();
      }

      this.roomCode = roomCode;
      this.participantId = participantId;
      this.isManualClose = false;

      const wsUrl = `${config.wsBaseUrl}/ws/room/${roomCode}?participant_id=${participantId}`;

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.ws = null;

          if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('WebSocket disconnected');
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      console.log('Manually closed');
      this.ws.close();
      this.ws = null;
    }
    this.roomCode = null;
    this.participantId = null;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      if (this.roomCode && this.participantId) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(this.roomCode, this.participantId).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Send a message through WebSocket
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Register a message handler
   */
  on(messageType: WebSocketMessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType)!.add(handler);

    return () => {
      this.messageHandlers.get(messageType)?.delete(handler);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }
  }

  /**
   * Update participant state
   */
  updateParticipant(updates: {
    voice_enabled?: boolean;
    is_speaking?: boolean;
    video_enabled?: boolean;
  }): void {
    this.send({
      type: 'participant_update',
      data: updates,
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(content: string): void {
    this.send({
      type: 'chat_message',
      data: {
        content,
      },
    });
  }

  /**
   * Start a game
   */
  startGame(gameId: string): void {
    this.send({
      type: 'game_start',
      data: {
        game_id: gameId,
      },
    });
  }

  /**
   * Update game state
   */
  updateGameState(gameId: string, state: any): void {
    this.send({
      type: 'game_state_update',
      data: {
        game_id: gameId,
        state,
      },
    });
  }

  /**
   * End current game
   */
  endGame(): void {
    this.send({
      type: 'game_start',
      data: {
        game_id: null,
      },
    });
  }

  /**
   * Propose a game (or end)
   */
  proposeGame(gameId: string, type: 'START' | 'END' = 'START'): void {
    this.send({
      type: 'propose_game',
      data: {
        game_id: gameId,
        type,
      },
    });
  }

  /**
   * Vote on a game proposal
   */
  voteGame(vote: boolean): void {
    this.send({
      type: 'vote_game',
      data: {
        vote,
      },
    });
  }

  /**
   * Finalize a game proposal (timeout)
   */
  finalizeProposal(): void {
    this.send({
      type: 'finalize_proposal',
      data: {},
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const websocketService = new WebSocketService();