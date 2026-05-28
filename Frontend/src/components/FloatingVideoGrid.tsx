import React, { useState, useEffect, useRef } from 'react';
import { Resizable } from 're-resizable';
import { Participant } from '../types/Room';
import { MediaParticipant, useLiveKitControls } from "../services/livekit";
import { VideoTile, VideoTileData } from "./VideoTile";

export interface ParticipantState {
  id: string; // identity
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export function useFloatingLayout(participants: MediaParticipant[]) {
  const [participantStates, setParticipantStates] = useState<ParticipantState[]>([]);

  // Sync participantStates with participants
  useEffect(() => {
    setParticipantStates(prev => {
      const prevMap = new Map(prev.map(p => [p.id, p]));

      return participants.map((p, index) => {
        if (prevMap.has(p.identity)) {
          return prevMap.get(p.identity)!;
        }

        // Initial positioning logic
        return {
          id: p.identity,
          position: {
            x: 20 + (index % 3) * 200,
            y: 80 + Math.floor(index / 3) * 150,
          },
          size: { width: 180, height: 135 },
        };
      });
    });
  }, [participants]);

  const updateParticipantState = (id: string, updates: Partial<ParticipantState>) => {
    setParticipantStates((prev) =>
      prev.map((state) => (state.id === id ? { ...state, ...updates } : state))
    );
  };

  return { participantStates, updateParticipantState };
}

interface FloatingVideoGridProps {
  participants: MediaParticipant[];
  currentUser: Participant;
  participantStates: ParticipantState[];
  onUpdateParticipantState: (id: string, updates: Partial<ParticipantState>) => void;
  hiddenParticipantIdentities: Set<string>;
  onHideParticipant: (identity: string) => void;
  isReadOnly?: boolean;
}

interface DraggableVideoCardProps {
  participant: MediaParticipant;
  currentUser: Participant;
  state: ParticipantState;
  onUpdateState: (id: string, updates: Partial<ParticipantState>) => void;
  onHide: (id: string) => void;
  controls: {
    toggleMute: (id: string, isLocal: boolean) => void;
    toggleVideo: (id: string, isLocal: boolean) => void;
  };
  isReadOnly?: boolean;
}



const DraggableVideoCard = ({ participant, currentUser, state, onUpdateState, onHide, controls, isReadOnly }: DraggableVideoCardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const tile: VideoTileData = {
    id: `${participant.identity}-camera-floating`,
    participant,
    type: 'camera',
    track: participant.videoTrack,
  };

  return (
    <Resizable
      size={state.size}
      minWidth={160}
      minHeight={120}
      onResizeStop={(e, direction, ref, d) => {
        onUpdateState(participant.identity, {
          size: {
            width: state.size.width + d.width,
            height: state.size.height + d.height,
          },
        });
      }}
      style={{ position: "fixed", left: state.position.x, top: state.position.y, zIndex: 1000 }}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full group pointer-events-auto"
        onMouseDown={isReadOnly ? undefined : (e) => {
          // Don't start a drag when interacting with buttons/controls
          if ((e.target as HTMLElement).closest('button')) {
            return;
          }
          const startX = e.clientX - state.position.x;
          const startY = e.clientY - state.position.y;
          // Use ownerDocument so dragging works in both the main window and PiP window
          const targetDoc = (e.currentTarget as HTMLElement).ownerDocument;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            onUpdateState(participant.identity, {
              position: {
                x: moveEvent.clientX - startX,
                y: moveEvent.clientY - startY,
              },
            });
          };

          const handleMouseUp = () => {
            targetDoc.removeEventListener('mousemove', handleMouseMove);
            targetDoc.removeEventListener('mouseup', handleMouseUp);
          };

          targetDoc.addEventListener('mousemove', handleMouseMove);
          targetDoc.addEventListener('mouseup', handleMouseUp);
        }}
        onTouchStart={isReadOnly ? undefined : (e) => {
          // Don't start a drag when interacting with buttons/controls
          if ((e.target as HTMLElement).closest('button')) {
            return;
          }
          const touch = e.touches[0];
          const startX = touch.clientX - state.position.x;
          const startY = touch.clientY - state.position.y;
          const targetDoc = (e.currentTarget as HTMLElement).ownerDocument;

          const handleTouchMove = (moveEvent: TouchEvent) => {
            moveEvent.preventDefault();
            const touch = moveEvent.touches[0];
            onUpdateState(participant.identity, {
              position: {
                x: touch.clientX - startX,
                y: touch.clientY - startY,
              },
            });
          };

          const handleTouchEnd = () => {
            targetDoc.removeEventListener('touchmove', handleTouchMove);
            targetDoc.removeEventListener('touchend', handleTouchEnd);
          };

          targetDoc.addEventListener('touchmove', handleTouchMove, { passive: false });
          targetDoc.addEventListener('touchend', handleTouchEnd);
        }}
      >
        {/* Floating Video Tile using shared VideoTile component */}
        <VideoTile
          tile={tile}
          controls={{
            toggleMute: controls.toggleMute,
            toggleVideo: controls.toggleVideo,
            toggleScreenShare: () => { },
          }}
          className="w-full h-full"
          isDraggable={false}
          parentRef={containerRef}
          hideScreenShareButton
          onHide={!isReadOnly ? () => onHide(participant.identity) : undefined}
        />
      </div>
    </Resizable>
  );
};

export default function FloatingVideoGrid({
  participants,
  currentUser,
  participantStates,
  onUpdateParticipantState,
  hiddenParticipantIdentities,
  onHideParticipant,
  isReadOnly
}: FloatingVideoGridProps) {
  const { toggleMute, toggleVideo } = useLiveKitControls();

  return (
    <>
      {participants.map((participant) => {
        // Safe check for hidden set
        if (hiddenParticipantIdentities && hiddenParticipantIdentities.has(participant.identity)) return null;

        const state = participantStates.find((s) => s.id === participant.identity);
        if (!state) return null;

        return (
          <DraggableVideoCard
            key={participant.identity}
            participant={participant}
            currentUser={currentUser}
            state={state}
            onUpdateState={onUpdateParticipantState}
            onHide={onHideParticipant}
            controls={{ toggleMute, toggleVideo }}
            isReadOnly={isReadOnly}
          />
        );
      })}
    </>
  );
}
