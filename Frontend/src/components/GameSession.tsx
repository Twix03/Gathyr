import React from 'react';
import { Room, Participant } from '../types/Room';
import ScribbleGame from './games/ScribbleGame';
import TriviaGame from './games/TriviaGame';
import ReactionGame from './games/ReactionGame';
import WordChainGame from './games/WordChainGame';
import TruthOrDareGame from './games/TruthOrDareGame';
import TwoTruthsGame from './games/TwoTruthsGame';
import { GameLayoutConfig } from './RoomPage';
import { MediaParticipant, useLiveKitControls } from "../services/livekit";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { VideoTile, VideoTileData } from './VideoTile';
import FloatingVideoGrid, { useFloatingLayout } from './FloatingVideoGrid';

interface GameSessionProps {
  gameId: string;
  room: Room;
  currentUser: Participant;
  onEndGame: () => void;
  onUpdateUser: (user: Participant) => void;
  gameLayoutConfig?: GameLayoutConfig;
  mediaParticipants?: MediaParticipant[];
  onHideParticipant?: (identity: string) => void;
}

export default function GameSession({
  gameId,
  room,
  currentUser,
  onEndGame,
  onUpdateUser,
  gameLayoutConfig,
  mediaParticipants = [],
  onHideParticipant,
}: GameSessionProps) {
  const { participantStates, updateParticipantState } = useFloatingLayout(mediaParticipants);
  const { toggleMute, toggleVideo, toggleScreenShare } = useLiveKitControls();

  const tiles = React.useMemo(() => {
    const t: VideoTileData[] = [];
    mediaParticipants.forEach(p => {
      t.push({ id: `${p.identity}-camera`, participant: p, type: 'camera', track: p.videoTrack });
      if (p.screenShareTrack) {
        t.push({ id: `${p.identity}-screen`, participant: p, type: 'screen', track: p.screenShareTrack });
      }
    });
    return t.sort((a, b) => {
      if (a.type === 'screen' && b.type !== 'screen') return -1;
      if (a.type !== 'screen' && b.type === 'screen') return 1;
      return 0;
    });
  }, [mediaParticipants]);

  const renderGame = () => {
    switch (gameId) {
      case 'scribble':
        return <ScribbleGame participants={room.participants} currentUser={currentUser} gameState={room.gameState} />;
      case 'trivia':
        return <TriviaGame participants={room.participants} currentUser={currentUser} />;
      case 'reaction':
        return <ReactionGame participants={room.participants} currentUser={currentUser} />;
      case 'wordchain':
        return <WordChainGame participants={room.participants} currentUser={currentUser} />;
      case 'truth-or-dare':
        return <TruthOrDareGame participants={room.participants} currentUser={currentUser} />;
      case 'two-truths':
        return <TwoTruthsGame participants={room.participants} currentUser={currentUser} />;
    }
  };

  const isDocked = gameLayoutConfig?.mode === 'docked';
  const edges = gameLayoutConfig?.edges || ['right'];

  const hasLeft = isDocked && edges.includes('left');
  const hasRight = isDocked && edges.includes('right');
  const hasTop = isDocked && edges.includes('top');
  const hasBottom = isDocked && edges.includes('bottom');

  const getTilesForEdge = (edge: string) => {
    if (!isDocked) return [];
    if (!edges.includes(edge as any)) return [];
    // distribute round-robin among active edges
    return tiles.filter((_, idx) => {
      return edges[idx % edges.length] === edge;
    });
  };

  const renderVideoStrip = (edge: string, direction: 'horizontal' | 'vertical') => {
    const edgeTiles = getTilesForEdge(edge);
    if (edgeTiles.length === 0) return null;

    return (
      <div className={`flex w-full h-full gap-3 p-3 bg-gradient-to-br from-black/30 to-purple-950/20 backdrop-blur-md border border-white/10 rounded-2xl ${direction === 'horizontal' ? 'flex-row overflow-x-auto overflow-y-hidden items-center' : 'flex-col overflow-y-auto overflow-x-hidden items-center'}`}>
        {edgeTiles.map(tile => (
          <VideoTile
            key={tile.id}
            tile={tile}
            controls={{ toggleMute, toggleVideo, toggleScreenShare }}
            onHide={onHideParticipant ? () => onHideParticipant(tile.participant.identity) : undefined}
            className={`flex-shrink-0 ${direction === 'horizontal' ? "h-full min-w-[200px] w-[200px]" : "w-full min-h-[150px] aspect-[4/3]"}`}
          />
        ))}
      </div>
    );
  };

  const renderGameArea = () => (
    <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto opacity-100 z-10">
        {renderGame()}
      </div>

      {gameLayoutConfig?.mode === 'custom' && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          <FloatingVideoGrid
            participants={mediaParticipants}
            currentUser={currentUser}
            participantStates={participantStates}
            onUpdateParticipantState={updateParticipantState}
            hiddenParticipantIdentities={new Set()}
            onHideParticipant={() => { }}
            isReadOnly={false}
          />
        </div>
      )}
    </div>
  );

  const CustomResizeHandle = ({ direction }: { direction: 'horizontal' | 'vertical' }) => (
    <PanelResizeHandle
      className={`relative flex items-center justify-center bg-transparent ${
        direction === 'horizontal' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'
      }`}
    >
      <div
        className={`absolute rounded-full transition-colors duration-200 bg-white/10 hover:bg-white/20 ${
          direction === 'horizontal'
            ? 'w-px h-6 left-1/2 -translate-x-1/2'
            : 'h-px w-6 top-1/2 -translate-y-1/2'
        }`}
      />
    </PanelResizeHandle>
  );

  return (
    <div className="flex-1 flex flex-col relative w-full h-full p-3 overflow-hidden">
      {isDocked ? (
        <PanelGroup direction="horizontal">
          {hasLeft && (
            <>
              <Panel defaultSize={20} minSize={10} maxSize={40} className="p-1">
                {renderVideoStrip('left', 'vertical')}
              </Panel>
              <CustomResizeHandle direction="horizontal" />
            </>
          )}

          <Panel minSize={30} className="p-1">
            <PanelGroup direction="vertical">
              {hasTop && (
                <>
                  <Panel defaultSize={20} minSize={10} maxSize={40} className="p-1">
                    {renderVideoStrip('top', 'horizontal')}
                  </Panel>
                  <CustomResizeHandle direction="vertical" />
                </>
              )}

              <Panel minSize={30} className="p-1">
                {renderGameArea()}
              </Panel>

              {hasBottom && (
                <>
                  <CustomResizeHandle direction="vertical" />
                  <Panel defaultSize={20} minSize={10} maxSize={40} className="p-1">
                    {renderVideoStrip('bottom', 'horizontal')}
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {hasRight && (
            <>
              <CustomResizeHandle direction="horizontal" />
              <Panel defaultSize={20} minSize={10} maxSize={40} className="p-1">
                {renderVideoStrip('right', 'vertical')}
              </Panel>
            </>
          )}
        </PanelGroup>
      ) : (
        <div className="w-full h-full">
          {renderGameArea()}
        </div>
      )}
    </div>
  );
}