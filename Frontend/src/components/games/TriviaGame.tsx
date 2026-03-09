import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Brain, Trophy, Clock } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

const questions: Question[] = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2,
    category: "Geography"
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1,
    category: "Science"
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
    correctAnswer: 2,
    category: "Art"
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    correctAnswer: 3,
    category: "Geography"
  },
  {
    question: "In which year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correctAnswer: 2,
    category: "History"
  },
  {
    question: "What is the chemical symbol for gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctAnswer: 2,
    category: "Science"
  },
];

interface TriviaGameProps {
  participants: Participant[];
  currentUser: Participant;
}

export default function TriviaGame({ participants, currentUser }: TriviaGameProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState<{ [key: string]: number }>(
    Object.fromEntries(participants.map(p => [p.id, 0]))
  );
  const [timeLeft, setTimeLeft] = useState(15);
  const [answeredParticipants, setAnsweredParticipants] = useState<Set<string>>(new Set());

  const currentQuestion = questions[currentQuestionIndex];

  // Timer
  useEffect(() => {
    if (!showResult && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !showResult) {
      handleSubmit();
    }
  }, [timeLeft, showResult]);

  // Simulate other players answering
  useEffect(() => {
    if (!showResult && timeLeft < 12 && timeLeft % 3 === 0) {
      const unanswered = participants.filter(p => 
        p.id !== currentUser.id && !answeredParticipants.has(p.id)
      );
      
      if (unanswered.length > 0) {
        const randomPlayer = unanswered[Math.floor(Math.random() * unanswered.length)];
        setAnsweredParticipants(prev => new Set([...prev, randomPlayer.id]));
        
        // 70% chance of correct answer
        const isCorrect = Math.random() > 0.3;
        if (isCorrect) {
          setScores(prev => ({
            ...prev,
            [randomPlayer.id]: (prev[randomPlayer.id] || 0) + Math.floor(timeLeft * 10)
          }));
        }
      }
    }
  }, [timeLeft, showResult]);

  const handleSubmit = () => {
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScores(prev => ({
        ...prev,
        [currentUser.id]: (prev[currentUser.id] || 0) + Math.floor(timeLeft * 10)
      }));
    }
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(15);
      setAnsweredParticipants(new Set());
    }
  };

  const sortedParticipants = [...participants].sort((a, b) => 
    (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/10 to-teal-900/10">
      <div className="max-w-4xl w-full">
        <div className="flex gap-6">
          {/* Question Area */}
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
                    <Brain className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3>Trivia Time</h3>
                    <p className="text-sm text-gray-400">{currentQuestion.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Clock className="w-5 h-5" />
                    <span className="text-2xl font-bold">{timeLeft}s</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                </div>
              </div>

              {/* Question */}
              <div className="mb-8">
                <h2 className="mb-6">{currentQuestion.question}</h2>

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = index === currentQuestion.correctAnswer;
                    const showCorrect = showResult && isCorrect;
                    const showWrong = showResult && isSelected && !isCorrect;

                    return (
                      <motion.button
                        key={index}
                        whileHover={!showResult ? { scale: 1.02 } : {}}
                        whileTap={!showResult ? { scale: 0.98 } : {}}
                        onClick={() => !showResult && setSelectedAnswer(index)}
                        disabled={showResult}
                        className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                          showCorrect
                            ? 'bg-green-500/20 border-green-500'
                            : showWrong
                            ? 'bg-red-500/20 border-red-500'
                            : isSelected
                            ? 'bg-purple-500/20 border-purple-500'
                            : 'bg-white/5 border-white/10 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              showCorrect
                                ? 'bg-green-500'
                                : showWrong
                                ? 'bg-red-500'
                                : isSelected
                                ? 'bg-purple-500'
                                : 'bg-white/10'
                            }`}
                          >
                            <span className="font-bold">
                              {String.fromCharCode(65 + index)}
                            </span>
                          </div>
                          <span>{option}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                {!showResult ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={selectedAnswer === null}
                    className="px-8 bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="px-8 bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}
                  </Button>
                )}
              </div>
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
                <h3>Leaderboard</h3>
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-600' :
                        'bg-white/10'
                      }`}>
                        <span className="font-bold">{index + 1}</span>
                      </div>
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{participant.name}</div>
                        {answeredParticipants.has(participant.id) && !showResult && (
                          <div className="text-xs text-green-400">Answered ✓</div>
                        )}
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
