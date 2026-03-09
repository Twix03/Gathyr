import React from 'react';
import { Room, Participant } from '../types/Room';
import { Button } from './ui/button';
import { X, Mic, MicOff } from 'lucide-react';
import ScribbleGame from './games/ScribbleGame';
import TriviaGame from './games/TriviaGame';
import ReactionGame from './games/ReactionGame';
import WordChainGame from './games/WordChainGame';
import TruthOrDareGame from './games/TruthOrDareGame';
import TwoTruthsGame from './games/TwoTruthsGame';

interface GameSessionProps {
  gameId: string;
  room: Room;
  currentUser: Participant;
  onEndGame: () => void;
  onUpdateUser: (user: Participant) => void;
}

export default function GameSession({
  gameId,
  room,
  currentUser,
  onEndGame,
  onUpdateUser,
}: GameSessionProps) {

  const renderGame = () => {
    switch (gameId) {
      case 'scribble':
        return <ScribbleGame participants={room.participants} currentUser={currentUser} />;
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

  return (
    <div className="flex-1 flex flex-col relative">

      {/* Game Area */}
      <div className="flex-1 overflow-auto">{renderGame()}</div>

      {/* Floating Participants */}
      <div className="absolute top-4 right-4 flex gap-2">
        {room.participants.map((participant) => (
          <div
            key={participant.id}
            className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-teal-900/50 border border-white/20 backdrop-blur-sm"
          >
            <img
              src={participant.avatar}
              alt={participant.name}
              className="w-full h-full object-cover"
            />
            {!participant.voiceEnabled && (
              <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <Button
          onClick={onEndGame}
          variant="outline"
          className="bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-sm"
        >
          <X className="w-4 h-4 mr-2" />
          End Game
        </Button>
      </div>
    </div>
  );
}