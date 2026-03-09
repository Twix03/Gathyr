import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, LayoutGrid, Maximize, Sidebar, Monitor, Grip } from 'lucide-react';
import { Room, Participant } from '../types/Room';
import { MediaParticipant, useLiveKitControls } from "../services/livekit";
import { useLocalPreferences } from "../services/LocalPreferencesContext";
import { Track } from 'livekit-client';

interface RoomHomeProps {
  room: Room;
  currentUser: Participant;
  onUpdateUser: (user: Participant) => void;
  mediaParticipants: MediaParticipant[];
}

type LayoutType = 'grid' | 'focus' | 'sidebar' | 'custom';

interface VideoTileData {
  id: string; // unique id for the tile (participantId + type)
  participant: MediaParticipant;
  type: 'camera' | 'screen';
  track?: Track;
}

const VideoTile = ({ tile, controls, className, isDraggable, parentRef }: {
  tile: VideoTileData,
  controls: {
    toggleMute: (id: string, isLocal: boolean) => void;
    toggleVideo: (id: string, isLocal: boolean) => void;
    toggleScreenShare: () => void;
  },
  className?: string,
  isDraggable?: boolean,
  parentRef?: React.RefObject<HTMLDivElement | null>
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const screenAudioRef = useRef<HTMLAudioElement>(null);
  const { isLocallyMuted, toggleLocalMute } = useLocalPreferences();
  const { participant, type, track } = tile;

  const locallyMuted = isLocallyMuted(participant.identity);
  // Screen audio uses a namespaced key so it's independent from mic mute
  const screenAudioMuted = isLocallyMuted(`${participant.identity}:screen`);
  const isScreen = type === 'screen';

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !track) return;
    track.attach(videoEl);
    return () => {
      track.detach(videoEl);
    };
  }, [track]);

  useEffect(() => {
    // Only attach audio for camera tiles to avoid double audio
    // Crucially, NEVER attach local participant's audio — nothing to play back
    if (type !== 'camera' || participant.isLocal) return;

    const audioEl = audioRef.current;
    if (!audioEl || !participant.audioTrack) return;
    participant.audioTrack.attach(audioEl);
    audioEl.play().catch(e => console.error("Audio play failed", e));
    return () => {
      participant.audioTrack?.detach(audioEl);
    };
  }, [participant.audioTrack, participant.isLocal, type]);

  // Screen share audio — only for screen tiles, only for remote participants
  useEffect(() => {
    if (type !== 'screen' || participant.isLocal) return;
    const audioEl = screenAudioRef.current;
    if (!audioEl || !participant.screenShareAudioTrack) return;
    participant.screenShareAudioTrack.attach(audioEl);
    audioEl.play().catch(e => console.error("Screen audio play failed", e));
    return () => {
      participant.screenShareAudioTrack?.detach(audioEl);
    };
  }, [participant.screenShareAudioTrack, participant.isLocal, type]);

  const isVideoEnabled = track ? !track.isMuted : false;
  const isAudioEnabled = participant.audioTrack ? !participant.audioTrack.isMuted : false;
  const isSpeaking = participant.isSpeaking;

  return (
    <motion.div
      layoutId={tile.id}
      drag={isDraggable}
      dragConstraints={parentRef}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, zIndex: 100, cursor: 'grabbing', boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.5)" }}
      className={`relative group rounded-2xl overflow-hidden border bg-zinc-900 ${isSpeaking && !isScreen
        ? 'border-purple-500 shadow-lg shadow-purple-500/30'
        : 'border-white/10'
        } ${className || ''} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* ================= BACKGROUND ================= */}
      {isVideoEnabled ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal} // Always mute local video playback
            className={`absolute inset-0 w-full h-full ${isScreen ? 'object-contain bg-zinc-950' : 'object-cover'}`}
          />
          {!isScreen && <div className="absolute inset-0 bg-black/10" />}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-teal-900/30">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center">
            {isScreen ? (
              <Monitor className="w-10 h-10 text-white" />
            ) : (
              <span className="text-3xl text-white">
                {participant.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Mic audio (camera tiles, remote only) */}
      {type === 'camera' && (
        <audio ref={audioRef} autoPlay muted={participant.isLocal || locallyMuted} />
      )}
      {/* Screen share audio (screen tiles, remote only) */}
      {type === 'screen' && (
        <audio ref={screenAudioRef} autoPlay muted={participant.isLocal || screenAudioMuted} />
      )}

      {/* ================= SPEAKING INDICATOR ================= */}
      {isSpeaking && !isScreen && (
        <motion.div
          className="absolute inset-0 border-4 border-purple-500 rounded-2xl pointer-events-none z-10"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* ================= BOTTOM INFO BAR ================= */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
        <div className="flex items-center gap-2 truncate flex-1">
          {isScreen && <Monitor size={14} className="text-purple-400" />}
          <span className="font-medium truncate text-sm text-white">
            {participant.name} {participant.isLocal ? '(You)' : ''}
            {isScreen && ' (Screen)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sshrink-0">
          {/* Sound Toggle — Camera mic (remote viewers only) */}
          {!participant.isLocal && type === 'camera' && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleLocalMute(participant.identity); }}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${!locallyMuted ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
              title={locallyMuted ? 'Unmute for me' : 'Mute for me'}
            >
              {locallyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}

          {/* Sound Toggle — Screen share audio (viewers only, not the sharer) */}
          {!participant.isLocal && type === 'screen' && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleLocalMute(`${participant.identity}:screen`); }}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${!screenAudioMuted ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
              title={screenAudioMuted ? 'Unmute screen audio for me' : 'Mute screen audio for me'}
            >
              {screenAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}

          {/* Mic Toggle (Camera only) */}
          {type === 'camera' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                controls.toggleMute(participant.identity, participant.isLocal);
              }}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors ${isAudioEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
            >
              {isAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            </button>
          )}

          {/* Video Toggle (Local only or indicator) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (participant.isLocal && type === 'camera') {
                controls.toggleVideo(participant.identity, participant.isLocal);
              }
            }}
            disabled={!participant.isLocal || type === 'screen'}
            className={`p-1.5 rounded-full backdrop-blur-sm transition-colors 
                ${(!participant.isLocal || type === 'screen')
                ? 'bg-white/5 text-white/50 cursor-default'
                : (isVideoEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white')
              }`}
          >
            {isVideoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
          </button>

          {/* Screen Share Button (Local only) */}
          {participant.isLocal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                controls.toggleScreenShare();
              }}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-colors 
                   ${participant.screenShareTrack
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/20 hover:bg-white/40 text-white'
                }`}
              title="Toggle Screen Share"
            >
              <Monitor size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};


export default function RoomHome({ room, currentUser, onUpdateUser, mediaParticipants }: RoomHomeProps) {
  const { toggleMute, toggleVideo, toggleScreenShare } = useLiveKitControls();
  const [layout, setLayout] = useState<LayoutType>('grid');
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Flatten media participants into tiles
  const tiles = useMemo(() => {
    const t: VideoTileData[] = [];
    mediaParticipants.forEach(p => {
      // Camera Tile
      t.push({
        id: `${p.identity}-camera`,
        participant: p,
        type: 'camera',
        track: p.videoTrack
      });

      // Screen Share Tile
      if (p.screenShareTrack) {
        t.push({
          id: `${p.identity}-screen`,
          participant: p,
          type: 'screen',
          track: p.screenShareTrack
        });
      }
    });
    // Sort logic? Active speakers first? Local last?
    // For now, simple order. Screen shares could be prioritized.
    return t.sort((a, b) => {
      // Put screen shares first
      if (a.type === 'screen' && b.type !== 'screen') return -1;
      if (a.type !== 'screen' && b.type === 'screen') return 1;
      return 0;
    });
  }, [mediaParticipants]);


  // --- Layout Renderers ---

  const renderGrid = () => {
    // Dynamic grid columns based on count
    const count = tiles.length;
    let gridClass = "grid-cols-1";
    if (count > 1) gridClass = "grid-cols-2";
    if (count > 4) gridClass = "grid-cols-3";
    if (count > 9) gridClass = "grid-cols-4";

    return (
      <div className={`grid ${gridClass} gap-4 h-full w-full p-6 auto-rows-fr`}>
        {tiles.map((tile) => (
          <VideoTile
            key={tile.id}
            tile={tile}
            controls={{ toggleMute, toggleVideo, toggleScreenShare }}
            className="w-full h-full"
          />
        ))}
      </div>
    );
  };

  const renderFocus = () => {
    // Priority: Screen Share -> Active Speaker -> First in list
    const mainTile = tiles.find(t => t.type === 'screen') ||
      tiles.find(t => t.participant.isSpeaking && !t.participant.isLocal) ||
      tiles[0];

    const others = tiles.filter(t => t.id !== mainTile?.id);

    return (
      <div className="flex flex-col h-full w-full p-6 gap-4">
        {/* Main Stage */}
        <div className="flex-1 min-h-0">
          {mainTile && (
            <VideoTile
              key={mainTile.id}
              tile={mainTile}
              controls={{ toggleMute, toggleVideo, toggleScreenShare }}
              className="w-full h-full"
            />
          )}
        </div>
        {/* Thumbnails */}
        {others.length > 0 && (
          <div className="h-40 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {others.map(tile => (
              <VideoTile
                key={tile.id}
                tile={tile}
                controls={{ toggleMute, toggleVideo, toggleScreenShare }}
                className="w-56 flex-shrink-0"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = () => {
    // Similar to Focus but sidebar is vertical
    const mainTile = tiles.find(t => t.type === 'screen') || tiles[0];
    const others = tiles.filter(t => t.id !== mainTile?.id);

    return (
      <div className="flex h-full w-full p-6 gap-4">
        {/* Main Stage */}
        <div className="flex-1 min-w-0">
          {mainTile && (
            <VideoTile
              key={mainTile.id}
              tile={mainTile}
              controls={{ toggleMute, toggleVideo, toggleScreenShare }}
              className="w-full h-full"
            />
          )}
        </div>
        {/* Sidebar */}
        {others.length > 0 && (
          <div className="w-64 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
            {others.map(tile => (
              <VideoTile
                key={tile.id}
                tile={tile}
                controls={{ toggleMute, toggleVideo, toggleScreenShare }}
                className="w-full aspect-video flex-shrink-0"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCustom = () => {
    // Freeform layout: Start as a grid (flex wrap) but allow dragging
    return (
      <div ref={constraintsRef} className="w-full h-full p-6 relative overflow-hidden bg-white/5">
        <div className="flex flex-wrap gap-4 content-start h-full">
          {tiles.map(tile => (
            <VideoTile
              key={tile.id}
              tile={tile}
              controls={{ toggleMute, toggleVideo, toggleScreenShare }}
              className="w-80 h-60 flex-shrink-0 shadow-xl"
              isDraggable={true}
              parentRef={constraintsRef}
            />
          ))}
        </div>

        {/* Hint Text */}
        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none text-white/20 text-sm">
          Drag tiles to arrange freely
        </div>
      </div>
    )
  }


  return (
    <div className="h-full w-full relative bg-[#13111b]">
      {/* Layout Config Bar (Floating) */}
      <div className="absolute top-6 right-6 z-50 flex gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
        <button
          onClick={() => setLayout('grid')}
          className={`p-2 rounded-lg transition-all ${layout === 'grid' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Grid View"
        >
          <LayoutGrid size={20} />
        </button>
        <button
          onClick={() => setLayout('focus')}
          className={`p-2 rounded-lg transition-all ${layout === 'focus' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Focus View"
        >
          <Maximize size={20} />
        </button>
        <button
          onClick={() => setLayout('sidebar')}
          className={`p-2 rounded-lg transition-all ${layout === 'sidebar' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Sidebar View"
        >
          <Sidebar size={20} />
        </button>
        <button
          onClick={() => setLayout('custom')}
          className={`p-2 rounded-lg transition-all ${layout === 'custom' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Custom View"
        >
          <Grip size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={layout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full"
        >
          {layout === 'grid' && renderGrid()}
          {layout === 'focus' && renderFocus()}
          {layout === 'sidebar' && renderSidebar()}
          {layout === 'custom' && renderCustom()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

