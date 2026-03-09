import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { CircleHelp, Flame } from 'lucide-react';

interface TruthOrDareGameProps {
  participants: Participant[];
  currentUser: Participant;
}

const truths = [
  "What's the most embarrassing thing you've ever done?",
  "What's a secret you've never told anyone?",
  "What's your biggest fear?",
  "Who was your first crush?",
  "What's the worst gift you've ever received?",
  "What's a lie you've told that you're not proud of?",
  "What's the most childish thing you still do?",
  "What's something you're glad your parents don't know about you?",
  "What's your worst habit?",
  "If you could change one thing about yourself, what would it be?",
];

const dares = [
  "Do your best celebrity impression",
  "Speak in an accent for the next 3 rounds",
  "Show the last photo in your camera roll",
  "Do 10 pushups right now",
  "Sing the chorus of your favorite song",
  "Share an unpopular opinion you have",
  "Tell a joke (it has to make someone laugh)",
  "Show your best dance move",
  "Speak in rhymes for the next minute",
  "Share the most recent text message you sent",
];

export default function TruthOrDareGame({ participants, currentUser }: TruthOrDareGameProps) {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [choice, setChoice] = useState<'truth' | 'dare' | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState('');
  const [showChallenge, setShowChallenge] = useState(false);

  const currentPlayer = participants[currentPlayerIndex];
  const isMyTurn = currentPlayer.id === currentUser.id;

  const handleChoice = (selected: 'truth' | 'dare') => {
    setChoice(selected);
    const challenges = selected === 'truth' ? truths : dares;
    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    setCurrentChallenge(randomChallenge);
    setShowChallenge(true);
  };

  const handleNext = () => {
    setCurrentPlayerIndex((currentPlayerIndex + 1) % participants.length);
    setChoice(null);
    setShowChallenge(false);
    setCurrentChallenge('');
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
            <h2 className="mb-2">Truth or Dare</h2>
            <p className="text-gray-400">Make your choice wisely!</p>
          </div>

          {/* Current Player */}
          <motion.div
            key={currentPlayerIndex}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-8"
          >
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <motion.img
                  src={currentPlayer.avatar}
                  alt={currentPlayer.name}
                  className="w-32 h-32 rounded-full border-4 border-purple-500"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                {isMyTurn && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 px-3 py-1 rounded-full bg-purple-500 text-white text-sm font-bold"
                  >
                    Your Turn!
                  </motion.div>
                )}
              </div>
              <h3 className="mb-1">{currentPlayer.name}</h3>
              <p className="text-gray-400">
                {isMyTurn ? "It's your turn!" : `Waiting for ${currentPlayer.name}...`}
              </p>
            </div>
          </motion.div>

          {/* Choice Buttons or Challenge */}
          <AnimatePresence mode="wait">
            {!showChallenge ? (
              <motion.div
                key="choices"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex gap-6 justify-center"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleChoice('truth')}
                  className="flex-1 max-w-xs p-12 rounded-3xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/50 hover:border-blue-400 transition-all group"
                >
                  <CircleHelp className="w-16 h-16 text-blue-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="mb-2 text-blue-300">Truth</h3>
                  <p className="text-sm text-gray-400">Answer honestly!</p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleChoice('dare')}
                  className="flex-1 max-w-xs p-12 rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-600/20 border-2 border-orange-500/50 hover:border-orange-400 transition-all group"
                >
                  <Flame className="w-16 h-16 text-orange-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="mb-2 text-orange-300">Dare</h3>
                  <p className="text-sm text-gray-400">Take the challenge!</p>
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="challenge"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                <div
                  className={`mb-8 p-8 rounded-3xl ${
                    choice === 'truth'
                      ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/50'
                      : 'bg-gradient-to-br from-orange-500/20 to-red-600/20 border-2 border-orange-500/50'
                  }`}
                >
                  <div className="mb-4">
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-bold ${
                        choice === 'truth'
                          ? 'bg-blue-500 text-white'
                          : 'bg-orange-500 text-white'
                      }`}
                    >
                      {choice === 'truth' ? 'TRUTH' : 'DARE'}
                    </span>
                  </div>
                  <p className="text-xl">{currentChallenge}</p>
                </div>

                <Button
                  onClick={handleNext}
                  size="lg"
                  className="px-12 bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                >
                  Next Player
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Players Queue */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-4 text-center">Up Next:</p>
            <div className="flex justify-center gap-3">
              {participants.map((participant, index) => {
                const position = (index - currentPlayerIndex + participants.length) % participants.length;
                if (position === 0 || position > 3) return null;

                return (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 0.5 + (1 - position * 0.2), scale: 1 }}
                    className="flex flex-col items-center"
                  >
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      className="w-12 h-12 rounded-full border-2 border-white/20 mb-1"
                    />
                    <span className="text-xs text-gray-400">{participant.name}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}