// Frontend/src/services/websocket/handlers/gameHandlers.ts

import { useEffect } from 'react';
import { websocketService } from '../websocket';
import type { Room } from '../../../types/Room';
import type { WebSocketMessage } from '../websocket';

interface GameHandlersConfig {
  setRoom: (room: Room | null | ((prev: Room | null) => Room | null)) => void;
  onGameStateUpdate?: (gameId: string, state: any) => void;
  onGameEvent?: (event: any) => void;
}

/**
 * Hook to register all game-related WebSocket handlers
 */
export function useGameHandlers({ setRoom, onGameStateUpdate, onGameEvent }: GameHandlersConfig) {
  useEffect(() => {
    // Game started handler
    const unsubGameStarted = websocketService.on('game_started', (message: WebSocketMessage) => {
      console.log('Game started');
      const gameId = message.data?.game_id;
      if (!gameId) return;

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proposal: null,
          currentGame: gameId,
        };
      });
    });

    // Game ended handler
    const unsubGameEnded = websocketService.on('game_ended', (message: WebSocketMessage) => {
      console.log('Game ended');
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proposal: null,
          currentGame: null,
          lastPlayed: prev.currentGame,
        };
      });
    });

    // Game state updated handler
    const unsubGameStateUpdated = websocketService.on('game_state_updated', (message: WebSocketMessage) => {
      console.log('Game state updated');
      const gameId = message.data?.game_id;
      const state = message.data?.state;

      if (gameId && state && onGameStateUpdate) {
        onGameStateUpdate(gameId, state);
      }
    });

    // Game event handler
    const unsubGameEvent = websocketService.on('game_event', (message: WebSocketMessage) => {
      console.log('Game event', message.data);
      if (onGameEvent && message.data) {
        onGameEvent(message.data);
      }
    });

    // Timer started handler
    const unsubTimerStarted = websocketService.on('timer_started', (message: WebSocketMessage) => {
      console.log('Timer started', message.data);
    });

    // Timer ended handler
    const unsubTimerEnded = websocketService.on('timer_ended', (message: WebSocketMessage) => {
      console.log('Timer ended', message.data);
    });

    // Cleanup function
    return () => {
      unsubGameStarted();
      unsubGameEnded();
      unsubGameStateUpdated();
      unsubGameEvent();
      unsubTimerStarted();
      unsubTimerEnded();
    };
  }, [setRoom, onGameStateUpdate, onGameEvent]);
}