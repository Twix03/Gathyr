import React, { useState } from 'react';
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
import { Menu, PictureInPicture2, PictureInPicture } from 'lucide-react';
import { useLiveKitMedia } from "../services/livekit";
import { websocketService } from '../services/websocket';
import { GameProposalModal } from './GameProposalModal';

interface RoomPageProps {
  room: Room;
  currentUser: Participant;
  onLeaveRoom: () => void;
  onUpdateRoom: (room: Room) => void;
  onUpdateUser: (user: Participant) => void;
}

type ViewType = 'home' | 'games';

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
  const [videoVisibility, setVideoVisibility] = useState<{ [id: string]: boolean }>(
    Object.fromEntries(room.participants.map((p) => [p.id, true]))
  );

  const mediaParticipants = useLiveKitMedia();

  // Layout state for the in-app floating grid (when on non-home views)
  const { participantStates, updateParticipantState } = useFloatingLayout(mediaParticipants);

  // Separate layout state for the PiP window -- independent positions that fit the smaller window
  const { participantStates: pipStates, updateParticipantState: pipUpdateState } =
    useFloatingLayout(mediaParticipants);

  // Picture-in-Picture — auto-opens when user switches to another browser tab
  const { isPiPOpen, isPiPSupported, pipWindow, openPiP, closePiP } = usePiP({
    enabled: mediaParticipants.length > 0,
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

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#1a1625] via-[#211934] to-[#2d1b3d]">
      {/* Sidebar Navigation */}
      {isSidebarOpen && (
        <RoomSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onLeaveRoom={onLeaveRoom}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-16 bg-black/20 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Toggle Sidebar Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
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
            <div className="text-sm text-gray-400">
              {room.participants.length} {room.participants.length === 1 ? 'person' : 'people'} in room
            </div>
            <ParticipantDropdown
              participants={room.participants}
              visibilityStates={videoVisibility}
              onToggleVisibility={toggleVideoVisibility}
            />

            {/* PiP Toggle — only shown in Chrome/Edge (document PiP supported) */}
            {isPiPSupported && (
              <button
                onClick={isPiPOpen ? closePiP : openPiP}
                className={`p-2 rounded-lg transition-colors ${isPiPOpen
                  ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
                  : 'hover:bg-white/10 text-white/60 hover:text-white'
                  }`}
                title={isPiPOpen ? 'Close floating video window' : 'Pop out videos (while you\'re in another tab)'}
              >
                {isPiPOpen ? (
                  <PictureInPicture2 className="w-5 h-5" />
                ) : (
                  <PictureInPicture className="w-5 h-5" />
                )}
              </button>
            )}
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
          />
        ) : (
          <div className="flex-1 overflow-auto">
            {currentView === 'home' && (
              <RoomHome
                room={room}
                currentUser={currentUser}
                onUpdateUser={onUpdateUser}
                mediaParticipants={mediaParticipants}
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
            />
          </div>
        </PiPPortal>
      )}
    </div>
  );
}