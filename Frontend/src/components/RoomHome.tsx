import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Monitor } from 'lucide-react';
import { Room, Participant } from '../types/Room';
import { MediaParticipant, useLiveKitControls } from "../services/livekit";
import { useLocalPreferences } from "../services/LocalPreferencesContext";
import { Track } from 'livekit-client';

interface RoomHomeProps {
  room: Room;
  currentUser: Participant;
  onUpdateUser: (user: Participant) => void;
  mediaParticipants: MediaParticipant[];
  layout: LayoutType;
  setLayout: (layout: LayoutType) => void;
  onHideParticipant?: (identity: string) => void;
  pinnedTileId?: string;
  onPinTile?: (tileId: string) => void;
}

type LayoutType = 'grid' | 'focus' | 'sidebar' | 'custom';
import { VideoTile, VideoTileData, VideoTilePosition, VideoTileSize } from './VideoTile';

const CUSTOM_TILE_WIDTH = 320;
const CUSTOM_TILE_HEIGHT = 200;
const CUSTOM_GAP = 16;
const CUSTOM_COLS = 3;

export default function RoomHome({ room, currentUser, onUpdateUser, mediaParticipants, layout, setLayout, onHideParticipant, pinnedTileId, onPinTile }: RoomHomeProps) {
  const { toggleMute, toggleVideo, toggleScreenShare } = useLiveKitControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [customLayoutState, setCustomLayoutState] = useState<Record<string, { position: VideoTilePosition; size: VideoTileSize }>>({});

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

  // Sync custom layout positions when tiles list changes (new tiles get grid positions)
  useEffect(() => {
    if (layout !== 'custom') return;
    setCustomLayoutState((prev) => {
      const next = { ...prev };
      tiles.forEach((tile, index) => {
        if (next[tile.id]) return;
        const col = index % CUSTOM_COLS;
        const row = Math.floor(index / CUSTOM_COLS);
        next[tile.id] = {
          position: {
            x: col * (CUSTOM_TILE_WIDTH + CUSTOM_GAP),
            y: row * (CUSTOM_TILE_HEIGHT + CUSTOM_GAP),
          },
          size: { width: CUSTOM_TILE_WIDTH, height: CUSTOM_TILE_HEIGHT },
        };
      });
      return next;
    });
  }, [layout, tiles]);

  const updateCustomTileState = (tileId: string, updates: { position?: VideoTilePosition; size?: VideoTileSize }) => {
    setCustomLayoutState((prev) => {
      const cur = prev[tileId];
      if (!cur) return prev;
      return { ...prev, [tileId]: { ...cur, ...updates } };
    });
  };

  // --- Layout Renderers ---

  const renderGrid = () => {
    // Responsive grid columns
    const count = tiles.length;
    let gridClass = "grid-cols-1";
    if (count > 1) gridClass = "grid-cols-1 sm:grid-cols-2";
    if (count > 4) gridClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    if (count > 9) gridClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

    return (
      <div className={`grid ${gridClass} gap-4 h-full w-full p-6 auto-rows-fr`}>
        {tiles.map((tile) => (
          <VideoTile
            key={tile.id}
            tile={tile}
            controls={{ toggleMute, toggleVideo, toggleScreenShare }}
            className="w-full h-full"
            onHide={onHideParticipant ? () => onHideParticipant(tile.participant.identity) : undefined}
            onPin={onPinTile ? () => onPinTile(tile.id) : undefined}
            isPinned={pinnedTileId === tile.id}
          />
        ))}
      </div>
    );
  };

  const renderFocus = () => {
    // Priority: Pinned -> Screen Share -> Active Speaker -> First in list
    const mainTile = (pinnedTileId ? tiles.find(t => t.id === pinnedTileId) : null) ||
      tiles.find(t => t.type === 'screen') ||
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
              onHide={onHideParticipant ? () => onHideParticipant(mainTile.participant.identity) : undefined}
              onPin={onPinTile ? () => onPinTile(mainTile.id) : undefined}
              isPinned={pinnedTileId === mainTile.id}
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
                onHide={onHideParticipant ? () => onHideParticipant(tile.participant.identity) : undefined}
                onPin={onPinTile ? () => onPinTile(tile.id) : undefined}
                isPinned={pinnedTileId === tile.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = () => {
    // Priority: Pinned -> Screen Share -> First in list
    const mainTile = (pinnedTileId ? tiles.find(t => t.id === pinnedTileId) : null) ||
      tiles.find(t => t.type === 'screen') || 
      tiles[0];
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
              onHide={onHideParticipant ? () => onHideParticipant(mainTile.participant.identity) : undefined}
              onPin={onPinTile ? () => onPinTile(mainTile.id) : undefined}
              isPinned={pinnedTileId === mainTile.id}
            />
          )}
        </div>
        {/* Sidebar */}
        {others.length > 0 && (
          <div className="w-40 md:w-64 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
            {others.map(tile => (
              <VideoTile
                key={tile.id}
                tile={tile}
                controls={{ toggleMute, toggleVideo, toggleScreenShare }}
                className="w-full aspect-video flex-shrink-0"
                onHide={onHideParticipant ? () => onHideParticipant(tile.participant.identity) : undefined}
                onPin={onPinTile ? () => onPinTile(tile.id) : undefined}
                isPinned={pinnedTileId === tile.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCustom = () => {
    return (
      <div ref={constraintsRef} className="w-full h-full p-6 relative overflow-hidden bg-white/5">
        {tiles.map((tile) => {
          const state = customLayoutState[tile.id];
          if (!state) return null;
          return (
            <VideoTile
              key={tile.id}
              tile={tile}
              controls={{ toggleMute, toggleVideo, toggleScreenShare }}
              className="w-full h-full shadow-xl"
              isDraggable
              isResizable
              parentRef={constraintsRef}
              position={state.position}
              size={state.size}
              onDragStop={(_e, d) => updateCustomTileState(tile.id, { position: { x: d.x, y: d.y } })}
              onResizeStop={(_e, _dir, _ref, delta) =>
                updateCustomTileState(tile.id, {
                  size: { width: state.size.width + delta.width, height: state.size.height + delta.height },
                })
              }
              onHide={onHideParticipant ? () => onHideParticipant(tile.participant.identity) : undefined}
              onPin={onPinTile ? () => onPinTile(tile.id) : undefined}
              isPinned={pinnedTileId === tile.id}
            />
          );
        })}

        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none text-white/20 text-sm">
          Drag tiles to arrange • Resize from bottom-right corner
        </div>
      </div>
    );
  };


  return (
    <div className="h-full w-full relative bg-[#13111b]">
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

