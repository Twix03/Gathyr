import React, { useState, useEffect } from 'react';
import { Room, Participant } from '../types/Room';
import RoomSidebar from './RoomSidebar';
import RoomHome from './RoomHome';
import GamesCarousel from './GamesCarousel';
import GameSession from './GameSession';
import ChatPanel from './ChatPanel';
import FloatingVideoGrid, { useFloatingLayout } from './FloatingVideoGrid';
import ParticipantDropdown from './ParticipantDropdown';
import { PiPPortal } from './PiPPortal';
import { usePiP } from '../services/usePiP';
import { Menu, PictureInPicture2, PictureInPicture, LayoutGrid, Maximize, Sidebar as SidebarIcon, Grip, X, Maximize2, Minimize2 } from 'lucide-react';
import { useLiveKitMedia } from "../services/livekit";
import { websocketService } from '../services/websocket';
import { GameProposalModal } from './GameProposalModal';
import { BugReportModal } from './BugReportModal';
import { motion, AnimatePresence } from 'motion/react';

interface RoomPageProps {
  room: Room;
  currentUser: Participant;
  onLeaveRoom: () => void;
  onUpdateRoom: (room: Room) => void;
  onUpdateUser: (user: Participant) => void;
}

type ViewType = 'home' | 'games';
type LayoutType = 'grid' | 'focus' | 'sidebar' | 'custom';

export type GameEdge = 'top' | 'bottom' | 'left' | 'right';
export interface GameLayoutConfig {
  mode: 'docked' | 'custom';
  edges: GameEdge[];
}

const LAYOUT_KEY = 'gathyr_layout';

const LAYOUT_OPTIONS: { id: LayoutType; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'grid', label: 'Grid', icon: LayoutGrid, description: 'Equal tiles for everyone' },
  { id: 'focus', label: 'Focus', icon: Maximize, description: 'One main tile + thumbnails' },
  { id: 'sidebar', label: 'Sidebar', icon: SidebarIcon, description: 'Main tile with side strip' },
  { id: 'custom', label: 'Custom', icon: Grip, description: 'Drag tiles freely' },
];

export default function RoomPage({
  room,
  currentUser,
  onLeaveRoom,
  onUpdateRoom,
  onUpdateUser,
}: RoomPageProps) {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedTileId, setPinnedTileId] = useState<string | undefined>(undefined);
  const [videoVisibility, setVideoVisibility] = useState<{ [id: string]: boolean }>(
    Object.fromEntries(room.participants.map((p) => [p.id, true]))
  );

  // --- Persistent layout state ---
  const [layout, setLayoutState] = useState<LayoutType>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY) as LayoutType | null;
    return (saved && ['grid', 'focus', 'sidebar', 'custom'].includes(saved)) ? saved : 'grid';
  });

  const setLayout = (l: LayoutType) => {
    setLayoutState(l);
    localStorage.setItem(LAYOUT_KEY, l);
  };

  // --- Persistent Game layout state ---
  const GAME_LAYOUT_KEY = 'gathyr_game_layout';
  const [gameLayout, setGameLayoutState] = useState<GameLayoutConfig>(() => {
    const saved = localStorage.getItem(GAME_LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.mode && Array.isArray(parsed.edges)) return parsed;
      } catch (e) { }
    }
    return { mode: 'docked', edges: ['right'] };
  });

  const setGameLayout = (config: GameLayoutConfig) => {
    setGameLayoutState(config);
    localStorage.setItem(GAME_LAYOUT_KEY, JSON.stringify(config));
  };

  const toggleGameEdge = (edge: GameEdge) => {
    setGameLayout(prev => {
      const edges = prev.edges.includes(edge)
        ? prev.edges.filter(e => e !== edge)
        : [...prev.edges, edge];
      // Require at least one edge in docked mode
      if (edges.length === 0 && prev.mode === 'docked') return prev;
      return { ...prev, edges };
    });
  };

  // --- Persistent PiP state ---
  const PIP_KEY = 'gathyr_pip_enabled';
  const [pipEnabled, setPipEnabledState] = useState<boolean>(() => {
    return localStorage.getItem(PIP_KEY) === 'true';
  });

  const setPipEnabled = (enabled: boolean) => {
    setPipEnabledState(enabled);
    localStorage.setItem(PIP_KEY, enabled ? 'true' : 'false');
  };

  const mediaParticipants = useLiveKitMedia();

  const visibleMediaParticipants = mediaParticipants.filter(
    (p) => videoVisibility[p.identity] !== false
  );

  // Layout state for the in-app floating grid (when on non-home views)
  const { participantStates, updateParticipantState } = useFloatingLayout(mediaParticipants);

  // Separate layout state for the PiP window -- independent positions that fit the smaller window
  const { participantStates: pipStates, updateParticipantState: pipUpdateState } =
    useFloatingLayout(mediaParticipants);

  // Picture-in-Picture — auto-opens when user switches to another browser tab
  const { isPiPOpen, isPiPSupported, pipWindow, openPiP, closePiP } = usePiP({
    enabled: pipEnabled && mediaParticipants.length > 0,
    width: 420,
    height: 360,
  });

  const handleStartGame = (gameId: string) => {
    websocketService.proposeGame(gameId);
  };

  const handleEndGame = () => {
    if (room.currentGame) {
      websocketService.proposeGame(room.currentGame, 'END');
    }
  };

  const toggleVideoVisibility = (id: string) => {
    setVideoVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePinTile = (tileId: string) => {
    if (pinnedTileId === tileId) {
      setPinnedTileId(undefined);
    } else {
      setPinnedTileId(tileId);
      if (layout === 'grid') {
        setLayout('focus');
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#1a1625] via-[#211934] to-[#2d1b3d] pb-0 md:pb-0">
      {/* Sidebar Navigation (Desktop only, controlled by toggle) */}
      {isSidebarOpen && (
        <RoomSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onLeaveRoom={onLeaveRoom}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative pb-16 md:pb-0">
        {/* Top Bar */}
        <div className="h-16 bg-black/20 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4 md:px-6 relative z-30">
          <div className="flex items-center gap-4">
            {/* Toggle Sidebar Button (Desktop only) */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:block p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="text-sm text-gray-400">Room Code</div>
              <div className="font-mono tracking-wider">{room.code}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}?room=${room.code}`
                );
              }}
              className="px-3 py-1 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Copy Invite
            </button>
          </div>

          <div className="flex items-center gap-3">
            {room.currentGame && (
              <button
                onClick={handleEndGame}
                className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm border border-red-500/60 shadow-sm transition-colors"
              >
                End game
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <div className="text-sm text-gray-400">
              {room.participants.length} {room.participants.length === 1 ? 'person' : 'people'} in room
            </div>
            <ParticipantDropdown
              participants={room.participants}
              visibilityStates={videoVisibility}
              onToggleVisibility={toggleVideoVisibility}
            />
          </div>
        </div>

        {/* Content Area */}
        {room.currentGame ? (
          <GameSession
            gameId={room.currentGame}
            room={room}
            currentUser={currentUser}
            onEndGame={handleEndGame}
            onUpdateUser={onUpdateUser}
            gameLayoutConfig={gameLayout}
            mediaParticipants={visibleMediaParticipants}
            onHideParticipant={toggleVideoVisibility}
          />
        ) : (
          <div className="flex-1 overflow-auto">
            {currentView === 'home' && (
              <RoomHome
                room={room}
                currentUser={currentUser}
                onUpdateUser={onUpdateUser}
                mediaParticipants={visibleMediaParticipants}
                layout={layout}
                setLayout={setLayout}
                onHideParticipant={toggleVideoVisibility}
                pinnedTileId={pinnedTileId}
                onPinTile={handlePinTile}
              />
            )}
            {currentView === 'games' && (
              <GamesCarousel onStartGame={handleStartGame} />
            )}
          </div>
        )}

        {/* Proposal Modal */}
        {room.proposal && (
          <GameProposalModal
            proposal={room.proposal}
            currentUserId={currentUser.id}
            gameName={room.proposal.game_id}
          />
        )}
      </div>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        participants={room.participants}
        currentUser={currentUser}
      />

      {/* In-app Floating Video Grid (shown when NOT on home view) */}
      {currentView !== 'home' && !room.currentGame && (
        <FloatingVideoGrid
          participants={mediaParticipants}
          currentUser={currentUser}
          participantStates={participantStates}
          onUpdateParticipantState={updateParticipantState}
          hiddenParticipantIdentities={new Set(
            Object.entries(videoVisibility)
              .filter(([_, visible]) => !visible)
              .map(([id]) => id)
          )}
          onHideParticipant={toggleVideoVisibility}
        />
      )}

      {/* Document Picture-in-Picture — renders FloatingVideoGrid in a detached browser window */}
      {isPiPOpen && (
        <PiPPortal pipWindow={pipWindow}>
          <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#13111b' }}>
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              gathyr · drag to rearrange
            </div>
            <FloatingVideoGrid
              participants={mediaParticipants}
              currentUser={currentUser}
              participantStates={pipStates}
              onUpdateParticipantState={pipUpdateState}
              hiddenParticipantIdentities={new Set()}
              onHideParticipant={() => { }}
              isReadOnly={true}
            />
          </div>
        </PiPPortal>
      )}

      {/* ===== Layout Settings Modal ===== */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />

            {/* Modal Card */}
            <motion.div
              key="settings-modal"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,90vw)] rounded-2xl bg-[#1a1625] border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Settings</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Layout Picker */}
              <div className="p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {(room.currentGame || currentView === 'games') ? 'Game Layout' : 'Video Layout'}
                </p>
                {(room.currentGame || currentView === 'games') ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setGameLayout({ ...gameLayout, mode: 'docked' })}
                        className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left ${gameLayout.mode === 'docked'
                          ? 'bg-purple-500/20 border-purple-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <div className={`p-2 rounded-lg w-fit ${gameLayout.mode === 'docked' ? 'bg-purple-500/30' : 'bg-white/10'}`}>
                          <LayoutGrid size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Docked</div>
                          <div className="text-xs text-gray-500 mt-0.5">Videos fixed on edges</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setGameLayout({ ...gameLayout, mode: 'custom' })}
                        className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left ${gameLayout.mode === 'custom'
                          ? 'bg-purple-500/20 border-purple-500/50 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <div className={`p-2 rounded-lg w-fit ${gameLayout.mode === 'custom' ? 'bg-purple-500/30' : 'bg-white/10'}`}>
                          <Grip size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Floating</div>
                          <div className="text-xs text-gray-500 mt-0.5">Drag tiles freely</div>
                        </div>
                      </button>
                    </div>

                    {gameLayout.mode === 'docked' && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Dock Videos To</p>
                        <div className="flex flex-wrap gap-2">
                          {(['top', 'bottom', 'left', 'right'] as GameEdge[]).map(edge => {
                            const active = gameLayout.edges.includes(edge);
                            return (
                              <button
                                key={edge}
                                onClick={() => toggleGameEdge(edge)}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex capitalize items-center gap-2 ${active
                                    ? 'bg-purple-500/20 border-purple-500/50 text-white font-medium'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                  }`}
                              >
                                {edge}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {LAYOUT_OPTIONS.map(({ id, label, icon: Icon, description }) => {
                      const active = layout === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setLayout(id)}
                          className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left ${active
                            ? 'bg-purple-500/20 border-purple-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                          <div className={`p-2 rounded-lg w-fit ${active ? 'bg-purple-500/30' : 'bg-white/10'}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                          </div>
                          {active && (
                            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-purple-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isPiPSupported && (
                  <>
                    <div className="my-5 border-t border-white/10" />
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Multi-tasking</p>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <div className="text-sm font-medium text-white flex items-center gap-2">
                          <PictureInPicture2 size={16} className="text-purple-400" />
                          Picture-in-Picture
                        </div>
                        <div className="text-xs text-gray-400 mt-1 max-w-[200px]">
                          Pop out video grid automatically when you switch to another tab.
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <button
                        onClick={() => setPipEnabled(!pipEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${pipEnabled ? 'bg-purple-500' : 'bg-white/20'}`}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full shadow-md"
                          layout
                          initial={false}
                          animate={{ x: pipEnabled ? 20 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Feedback Modal ===== */}
      <BugReportModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        roomCode={room.code}
        userId={currentUser.id}
      />
    </div>
  );
}