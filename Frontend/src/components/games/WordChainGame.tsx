import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Link, Trophy } from 'lucide-react';

interface WordEntry {
  word: string;
  participant: Participant;
  timestamp: Date;
}

interface WordChainGameProps {
  participants: Participant[];
  currentUser: Participant;
}

const validWords = [
  'apple', 'elephant', 'tiger', 'rocket', 'table', 'energy', 'yellow', 'window',
  'orange', 'earth', 'house', 'eagle', 'nest', 'train', 'night', 'time',
  'mushroom', 'moon', 'navy', 'yarn', 'north', 'heart', 'tree', 'egg'
];

export default function WordChainGame({ participants, currentUser }: WordChainGameProps) {
  const [wordChain, setWordChain] = useState<WordEntry[]>([
    {
      word: 'start',
      participant: participants[0],
      timestamp: new Date(),
    }
  ]);
  const [inputWord, setInputWord] = useState('');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [scores, setScores] = useState<{ [key: string]: number }>(
    Object.fromEntries(participants.map(p => [p.id, 0]))
  );
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15);

  const currentParticipant = participants[currentTurn % participants.length];
  const isMyTurn = currentParticipant.id === currentUser.id;
  const lastWord = wordChain[wordChain.length - 1].word;
  const requiredFirstLetter = lastWord[lastWord.length - 1].toLowerCase();

  // Timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Time's up! Skip turn
      handleNextTurn();
    }
  }, [timeLeft]);

  // Bot players
  useEffect(() => {
    if (!isMyTurn && timeLeft < 12) {
      const possibleWords = validWords.filter(w => 
        w.startsWith(requiredFirstLetter) && 
        !wordChain.some(entry => entry.word.toLowerCase() === w)
      );
      
      if (possibleWords.length > 0) {
        const randomWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
        setTimeout(() => {
          addWord(randomWord, currentParticipant);
        }, 1000 + Math.random() * 2000);
      } else {
        setTimeout(() => {
          handleNextTurn();
        }, 3000);
      }
    }
  }, [isMyTurn, timeLeft]);

  const handleNextTurn = () => {
    setCurrentTurn(currentTurn + 1);
    setTimeLeft(15);
    setInputWord('');
    setError('');
  };

  const addWord = (word: string, participant: Participant) => {
    const newEntry: WordEntry = {
      word,
      participant,
      timestamp: new Date(),
    };
    
    setWordChain([...wordChain, newEntry]);
    setScores(prev => ({
      ...prev,
      [participant.id]: (prev[participant.id] || 0) + word.length * 10
    }));
    
    handleNextTurn();
  };

  const handleSubmit = () => {
    const word = inputWord.trim().toLowerCase();
    
    if (!word) {
      setError('Please enter a word');
      return;
    }
    
    if (!word.startsWith(requiredFirstLetter)) {
      setError(`Word must start with "${requiredFirstLetter.toUpperCase()}"`);
      return;
    }
    
    if (wordChain.some(entry => entry.word.toLowerCase() === word)) {
      setError('This word was already used!');
      return;
    }
    
    if (word.length < 3) {
      setError('Word must be at least 3 letters');
      return;
    }
    
    addWord(word, currentUser);
  };

  const sortedParticipants = [...participants].sort((a, b) => 
    (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/10 to-teal-900/10">
      <div className="max-w-5xl w-full">
        <div className="flex gap-6">
          {/* Game Area */}
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                    <Link className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3>Word Chain</h3>
                    <p className="text-sm text-gray-400">
                      Each word starts with the last letter of the previous word
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-400">{timeLeft}s</div>
                  <div className="text-sm text-gray-400">Time left</div>
                </div>
              </div>

              {/* Current Turn */}
              <div className="mb-6 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={currentParticipant.avatar}
                      alt={currentParticipant.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium">
                        {isMyTurn ? "Your turn!" : `${currentParticipant.name}'s turn`}
                      </div>
                      <div className="text-sm text-gray-400">
                        Word must start with "{requiredFirstLetter.toUpperCase()}"
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Word Chain Display */}
              <div className="mb-6 p-6 rounded-2xl bg-white/5 border border-white/10 max-h-64 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {wordChain.map((entry, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative"
                    >
                      <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-teal-500/20 border border-purple-500/30">
                        <div className="font-medium">{entry.word}</div>
                        <div className="text-xs text-gray-400">{entry.participant.name}</div>
                      </div>
                      {index < wordChain.length - 1 && (
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-purple-400">
                          →
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Input */}
              {isMyTurn && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Input
                      value={inputWord}
                      onChange={(e) => {
                        setInputWord(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      placeholder={`Enter a word starting with "${requiredFirstLetter.toUpperCase()}"...`}
                      className="bg-white/5 border-white/10"
                    />
                    <Button
                      onClick={handleSubmit}
                      className="bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                    >
                      Submit
                    </Button>
                  </div>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
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
                <h3>Scores</h3>
              </div>

              <div className="space-y-3">
                {sortedParticipants.map((participant, index) => (
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
                      </div>
                      <div className="text-purple-400 font-bold">
                        {scores[participant.id] || 0}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
