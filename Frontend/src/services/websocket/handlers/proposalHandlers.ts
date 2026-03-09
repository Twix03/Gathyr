// Frontend/src/services/websocket/handlers/proposalHandlers.ts

import { useEffect } from 'react';
import { websocketService } from '../websocket';
import type { Room } from '../../../types/Room';
import type { WebSocketMessage } from '../websocket';

interface ProposalHandlersConfig {
  setRoom: (room: Room | null | ((prev: Room | null) => Room | null)) => void;
}

/**
 * Hook to register all proposal-related WebSocket handlers
 */
export function useProposalHandlers({ setRoom }: ProposalHandlersConfig) {
  useEffect(() => {
    // Proposal created handler
    const unsubProposalCreated = websocketService.on('proposal_created', (message: WebSocketMessage) => {
      console.log('Proposal created');
      const proposal = message.data;
      if (!proposal) return;

      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proposal: proposal,
        };
      });
    });

    // Proposal updated handler (votes changed)
    const unsubProposalUpdated = websocketService.on('proposal_updated', (message: WebSocketMessage) => {
      console.log('Proposal updated');
      const { votes } = message.data || {};
      if (!votes) return;

      setRoom((prev) => {
        if (!prev || !prev.proposal) return prev;
        return {
          ...prev,
          proposal: {
            ...prev.proposal,
            votes,
          },
        };
      });
    });

    // Proposal failed handler
    const unsubProposalFailed = websocketService.on('proposal_failed', (message: WebSocketMessage) => {
      console.log('Proposal failed');
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proposal: null,
        };
      });
    });

    // Cleanup function
    return () => {
      unsubProposalCreated();
      unsubProposalUpdated();
      unsubProposalFailed();
    };
  }, [setRoom]);
}