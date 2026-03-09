import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { CircleCheck, CircleX, CircleHelp } from 'lucide-react';

interface TwoTruthsGameProps {
  participants: Participant[];
  currentUser: Participant;
}

const mockStatements = [
  { truths: ["I've visited 10 countries", "I can speak 3 languages"], lie: "I've met a celebrity" },
  { truths: ["I've broken 2 bones", "I can play the piano"], lie: "I've been skydiving" },
  { truths: ["I have a pet snake", "I love spicy food"], lie: "I can juggle" },
];

export default function TwoTruthsGame({ participants, currentUser }: TwoTruthsGameProps) {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [statements, setStatements] = useState<string[]>([]);
  const [lieIndex, setLieIndex] = useState<number>(-1);
  const [inputStatements, setInputStatements] = useState(['', '', '']);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number>(-1);
  const [showingStatements, setShowingStatements] = useState(false);
  const [votes, setVotes] = useState<{ [key: number]: number }>({ 0: 0, 1: 0, 2: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const currentPlayer = participants[currentPlayerIndex];
  const isMyTurn = currentPlayer.id === currentUser.id;

  useEffect(() => {
    if (!isMyTurn && !showingStatements) {
      // Auto-generate for bots
      setTimeout(() => {
        const mock = mockStatements[Math.floor(Math.random() * mockStatements.length)];
        const allStatements = [...mock.truths, mock.lie];
        // Shuffle
        for (let i = allStatements.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allStatements[i], allStatements[j]] = [allStatements[j], allStatements[i]];
        }
        const lieIdx = allStatements.indexOf(mock.lie);
        setStatements(allStatements);
        setLieIndex(lieIdx);
        setShowingStatements(true);
      }, 2000);
    }
  }, [currentPlayerIndex, isMyTurn]);

  // Simulate other players voting
  useEffect(() => {
    if (showingStatements && !showResults && !hasVoted && !isMyTurn) {
      const timer = setTimeout(() => {
        participants.forEach((p) => {
          if (p.id !== currentUser.id && p.id !== currentPlayer.id) {
            const randomVote = Math.floor(Math.random() * 3);
            setVotes(prev => ({ ...prev, [randomVote]: (prev[randomVote] || 0) + 1 }));
          }
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showingStatements, showResults]);

  const handleSubmitStatements = () => {
    if (inputStatements.every(s => s.trim()) && selectedLieIndex !== -1) {
      setStatements(inputStatements);
      setLieIndex(selectedLieIndex);
      setShowingStatements(true);
    }
  };

  const handleVote = (index: number) => {
    setVotes(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
    setHasVoted(true);
  };

  const handleShowResults = () => {
    setShowResults(true);
  };

  const handleNext = () => {
    setCurrentPlayerIndex((currentPlayerIndex + 1) % participants.length);
    setStatements([]);
    setLieIndex(-1);
    setInputStatements(['', '', '']);
    setSelectedLieIndex(-1);
    setShowingStatements(false);
    setVotes({ 0: 0, 1: 0, 2: 0 });
    setHasVoted(false);
    setShowResults(false);
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/10 to-teal-900/10">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-12 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="mb-2">Two Truths & A Lie</h2>
            <p className="text-gray-400">Can you spot the lie?</p>
          </div>

          {/* Current Player */}
          <div className="flex flex-col items-center mb-8">
            <img
              src={currentPlayer.avatar}
              alt={currentPlayer.name}
              className="w-24 h-24 rounded-full border-4 border-purple-500 mb-3"
            />
            <h3 className="mb-1">{currentPlayer.name}'s turn</h3>
            {isMyTurn && !showingStatements && (
              <p className="text-gray-400">Share your statements below</p>
            )}
          </div>

          {/* Input Phase (Player's turn) */}
          {isMyTurn && !showingStatements && (
            <div className="space-y-4 mb-6">
              <p className="text-center text-gray-400 mb-4">
                Enter two truths and one lie about yourself
              </p>
              {inputStatements.map((statement, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-3 items-center">
                    <Input
                      value={statement}
                      onChange={(e) => {
                        const newStatements = [...inputStatements];
                        newStatements[index] = e.target.value;
                        setInputStatements(newStatements);
                      }}
                      placeholder={`Statement ${index + 1}`}
                      className="flex-1 bg-white/5 border-white/10"
                    />
                    <button
                      onClick={() => setSelectedLieIndex(index)}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        selectedLieIndex === index
                          ? 'bg-red-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {selectedLieIndex === index ? 'This is the lie' : 'Mark as lie'}
                    </button>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleSubmitStatements}
                disabled={!inputStatements.every(s => s.trim()) || selectedLieIndex === -1}
                className="w-full bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
              >
                Share Statements
              </Button>
            </div>
          )}

          {/* Voting Phase */}
          {showingStatements && !showResults && (
            <div className="space-y-4 mb-6">
              <p className="text-center text-gray-400 mb-4">
                {isMyTurn ? 'Others are voting...' : 'Which one is the lie?'}
              </p>
              {statements.map((statement, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => !hasVoted && !isMyTurn && handleVote(index)}
                  disabled={hasVoted || isMyTurn}
                  className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${
                    hasVoted || isMyTurn
                      ? 'bg-white/5 border-white/10 cursor-not-allowed'
                      : 'bg-white/5 border-white/10 hover:border-purple-500/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="font-bold">{index + 1}</span>
                    </div>
                    <p>{statement}</p>
                  </div>
                </motion.button>
              ))}
              
              {(hasVoted || isMyTurn) && (
                <Button
                  onClick={handleShowResults}
                  className="w-full bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                >
                  Show Results
                </Button>
              )}
            </div>
          )}

          {/* Results Phase */}
          {showResults && (
            <div className="space-y-4 mb-6">
              <p className="text-center mb-4">Results:</p>
              {statements.map((statement, index) => {
                const isLie = index === lieIndex;
                const voteCount = votes[index] || 0;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-6 rounded-2xl border-2 ${
                      isLie
                        ? 'bg-red-500/20 border-red-500'
                        : 'bg-green-500/20 border-green-500'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isLie ? 'bg-red-500' : 'bg-green-500'
                      }`}>
                        {isLie ? (
                          <CircleX className="w-6 h-6 text-white" />
                        ) : (
                          <CircleCheck className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="mb-1">{statement}</p>
                        <p className="text-sm text-gray-400">{voteCount} votes</p>
                      </div>
                      <span className={`font-bold ${isLie ? 'text-red-400' : 'text-green-400'}`}>
                        {isLie ? 'LIE' : 'TRUTH'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              
              <Button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
              >
                Next Player
              </Button>
            </div>
          )}

          {/* Waiting state for non-current player */}
          {!isMyTurn && !showingStatements && (
            <div className="text-center text-gray-400">
              <CircleHelp className="w-12 h-12 mx-auto mb-3 animate-pulse" />
              <p>Waiting for {currentPlayer.name} to share their statements...</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}