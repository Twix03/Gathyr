import React, { useState, useEffect, useRef } from 'react';
import { Resizable } from 're-resizable';
import { Mic, MicOff, Video, VideoOff, X, Volume2, VolumeX } from 'lucide-react';
import { Participant } from '../types/Room';
// import { MediaParticipant } from "../services/useLiveKitMedia";
// import { useLiveKitControls } from "../services/useLiveKitControls";
import { MediaParticipant, useLiveKitControls } from "../services/livekit";
import { useLocalPreferences } from "../services/LocalPreferencesContext";

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
  }
}



const DraggableVideoCard = ({ participant, currentUser, state, onUpdateState, onHide, controls }: DraggableVideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isLocallyMuted, toggleLocalMute } = useLocalPreferences();

  const locallyMuted = isLocallyMuted(participant.identity);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !participant.videoTrack) return;
    participant.videoTrack.attach(videoEl);
    return () => {
      participant.videoTrack?.detach(videoEl);
    };
  }, [participant.videoTrack]);

  useEffect(() => {
    const audioEl = audioRef.current;
    // Never attach/play local participant's audio — prevents hearing yourself
    if (!audioEl || !participant.audioTrack || participant.isLocal) return;
    participant.audioTrack.attach(audioEl);
    audioEl.play().catch(e => console.error("Audio play failed", e));
    return () => {
      participant.audioTrack?.detach(audioEl);
    };
  }, [participant.audioTrack, participant.isLocal]);

  // Determine actual media state
  const isAudioEnabled = participant.audioTrack ? !participant.audioTrack.isMuted : false;
  const isVideoEnabled = participant.videoTrack ? !participant.videoTrack.isMuted : false;

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
        className="relative w-full h-full group rounded-lg overflow-hidden shadow-lg border border-white/10 bg-black/80"
        onMouseDown={(e) => {
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
      >
        {/* Video Layer */}
        <div className="w-full h-full relative bg-zinc-900">
          {isVideoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={participant.identity === currentUser.id}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-teal-900/30">
              <div className="w-[35%] max-w-[120px] aspect-square rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center">
                <span className="text-4xl text-white">
                  {participant.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Audio Element - hidden but functional */}
        <audio ref={audioRef} autoPlay muted={participant.isLocal || locallyMuted} />

        {/* Overlay Controls (Visible on Hover) */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">

          {/* Top Right: Hide Button */}
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onHide(participant.identity); }}
              className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
              title="Hide for me"
            >
              <X size={14} />
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white font-medium truncate flex-1 shadow-black drop-shadow-md">
              {participant.name || participant.identity} {participant.isLocal ? "(You)" : ""}
            </span>

            {/* Sound Button (Remote Only) */}
            {!participant.isLocal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocalMute(participant.identity);
                }}
                className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${!locallyMuted ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                title={locallyMuted ? "Unmute Sound" : "Mute Sound (For Me)"}
              >
                {locallyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}

            {/* Global Mute / Video Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); controls.toggleMute(participant.identity, participant.isLocal); }}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${isAudioEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
              title={participant.isLocal ? (isAudioEnabled ? "Mute Mic" : "Unmute Mic") : (isAudioEnabled ? "Mute Participant" : "Participant Muted")}
            >
              {isAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (participant.isLocal) {
                  controls.toggleVideo(participant.identity, participant.isLocal);
                }
              }}
              disabled={!participant.isLocal}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors 
                 ${!participant.isLocal
                  ? 'bg-white/5 text-white/50 cursor-not-allowed'
                  : (isVideoEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white')
                }`}
              title={participant.isLocal ? "Toggle Video" : "Video Control Blocked"}
            >
              {isVideoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
            </button>
          </div>
        </div>
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
  onHideParticipant
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
          />
        );
      })}
    </>
  );
}
