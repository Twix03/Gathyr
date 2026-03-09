import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Zap, Trophy, Timer } from 'lucide-react';

interface ReactionGameProps {
  participants: Participant[];
  currentUser: Participant;
}

type GameState = 'waiting' | 'ready' | 'go' | 'results';

export default function ReactionGame({ participants, currentUser }: ReactionGameProps) {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<{ [key: string]: number[] }>(
    Object.fromEntries(participants.map(p => [p.id, []]))
  );
  const [roundWinner, setRoundWinner] = useState<Participant | null>(null);

  const maxRounds = 5;

  useEffect(() => {
    if (gameState === 'waiting') {
      const timer = setTimeout(() => {
        setGameState('ready');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (gameState === 'ready') {
      const randomDelay = 1000 + Math.random() * 3000;
      const timer = setTimeout(() => {
        setGameState('go');
        setStartTime(Date.now());
        
        // Simulate other players clicking
        setTimeout(() => {
          participants.forEach(p => {
            if (p.id !== currentUser.id) {
              const botTime = 200 + Math.random() * 400;
              setScores(prev => ({
                ...prev,
                [p.id]: [...prev[p.id], botTime]
              }));
            }
          });
        }, 250);
      }, randomDelay);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const handleClick = () => {
    if (gameState === 'go' && reactionTime === null) {
      const time = Date.now() - startTime;
      setReactionTime(time);
      setScores(prev => ({
        ...prev,
        [currentUser.id]: [...prev[currentUser.id], time]
      }));
      
      // Determine round winner
      const allTimes = { ...scores, [currentUser.id]: [...scores[currentUser.id], time] };
      let fastestTime = time;
      let winner = currentUser;
      
      participants.forEach(p => {
        const times = allTimes[p.id];
        if (times.length > 0) {
          const lastTime = times[times.length - 1];
          if (lastTime < fastestTime) {
            fastestTime = lastTime;
            winner = p;
          }
        }
      });
      
      setRoundWinner(winner);
      setGameState('results');
    } else if (gameState === 'ready') {
      // Too early!
      setReactionTime(-1);
      setGameState('results');
    }
  };

  const nextRound = () => {
    if (round < maxRounds) {
      setRound(round + 1);
      setReactionTime(null);
      setRoundWinner(null);
      setGameState('waiting');
    }
  };

  const getAverageTime = (participantId: string) => {
    const times = scores[participantId].filter(t => t > 0);
    if (times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    const avgA = getAverageTime(a.id);
    const avgB = getAverageTime(b.id);
    if (avgA === 0) return 1;
    if (avgB === 0) return -1;
    return avgA - avgB;
  });

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/10 to-teal-900/10">
      <div className="max-w-5xl w-full">
        <div className="flex gap-6">
          {/* Game Area */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {gameState === 'waiting' && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-12 rounded-3xl bg-blue-500/10 border-2 border-blue-500/30 text-center"
                >
                  <Timer className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h2 className="mb-2">Get Ready...</h2>
                  <p className="text-gray-400">Wait for the green screen!</p>
                </motion.div>
              )}

              {gameState === 'ready' && (
                <motion.button
                  key="ready"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleClick}
                  className="w-full p-24 rounded-3xl bg-red-500/20 border-2 border-red-500/50 text-center cursor-pointer"
                >
                  <h1 className="text-red-400">Wait...</h1>
                </motion.button>
              )}

              {gameState === 'go' && (
                <motion.button
                  key="go"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleClick}
                  className="w-full p-24 rounded-3xl bg-green-500/20 border-2 border-green-500/50 text-center cursor-pointer hover:bg-green-500/30 transition-colors"
                >
                  <Zap className="w-20 h-20 text-green-400 mx-auto mb-4" />
                  <h1 className="text-green-400">CLICK NOW!</h1>
                </motion.button>
              )}

              {gameState === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-12 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 text-center"
                >
                  {reactionTime === -1 ? (
                    <>
                      <h2 className="text-red-400 mb-4">Too Early!</h2>
                      <p className="text-gray-400 mb-6">Wait for the green screen!</p>
                    </>
                  ) : (
                    <>
                      <h2 className="mb-2">Your Time</h2>
                      <div className="text-6xl font-bold text-purple-400 mb-6">
                        {reactionTime}ms
                      </div>
                      {roundWinner && (
                        <div className="mb-6">
                          <p className="text-gray-400 mb-2">Round Winner:</p>
                          <div className="flex items-center justify-center gap-3">
                            <img
                              src={roundWinner.avatar}
                              alt={roundWinner.name}
                              className="w-10 h-10 rounded-full"
                            />
                            <span className="text-yellow-400 font-bold">
                              {roundWinner.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-3 justify-center">
                    {round < maxRounds ? (
                      <Button
                        onClick={nextRound}
                        className="px-8 bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                      >
                        Round {round + 1} of {maxRounds}
                      </Button>
                    ) : (
                      <div className="text-purple-400">
                        Game Complete! Check the leaderboard →
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress */}
            <div className="mt-6 flex gap-2 justify-center">
              {Array.from({ length: maxRounds }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-12 rounded-full ${
                    i < round ? 'bg-purple-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="w-80">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 sticky top-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <h3>Leaderboard</h3>
              </div>

              <div className="space-y-3">
                {sortedParticipants.map((participant, index) => {
                  const avgTime = getAverageTime(participant.id);
                  const roundsPlayed = scores[participant.id].filter(t => t > 0).length;

                  return (
                    <motion.div
                      key={participant.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-3 rounded-xl ${
                        participant.id === currentUser.id
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            index === 0
                              ? 'bg-yellow-500'
                              : index === 1
                              ? 'bg-gray-400'
                              : index === 2
                              ? 'bg-orange-600'
                              : 'bg-white/10'
                          }`}
                        >
                          <span className="font-bold">{index + 1}</span>
                        </div>
                        <img
                          src={participant.avatar}
                          alt={participant.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{participant.name}</div>
                          <div className="text-xs text-gray-400">
                            {roundsPlayed} {roundsPlayed === 1 ? 'round' : 'rounds'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-purple-400 font-bold">
                            {avgTime > 0 ? `${avgTime}ms` : '-'}
                          </div>
                          <div className="text-xs text-gray-500">avg</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
