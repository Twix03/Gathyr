import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Brain, Zap, Clock, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

interface Game {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  players: string;
  duration: string;
  icon: typeof Pencil;
}

const games: Game[] = [
  {
    id: 'scribble',
    name: 'Scribble',
    description: 'Draw and guess with friends. Take turns drawing while others guess what it is!',
    thumbnail: '🎨',
    category: 'Quick & Casual',
    players: '2-8 players',
    duration: '5-10 min',
    icon: Pencil,
  },
  {
    id: 'trivia',
    name: 'Trivia Time',
    description: 'Test your knowledge across various categories. First to answer wins!',
    thumbnail: '🧠',
    category: 'Quick & Casual',
    players: '2-10 players',
    duration: '10-15 min',
    icon: Brain,
  },
  {
    id: 'reaction',
    name: 'Quick Draw',
    description: 'Fast-paced reaction game. Be the quickest to respond and win!',
    thumbnail: '⚡',
    category: 'Quick & Casual',
    players: '2-6 players',
    duration: '3-5 min',
    icon: Zap,
  },
  {
    id: 'wordchain',
    name: 'Word Chain',
    description: 'Create a chain of words where each word starts with the last letter of the previous word.',
    thumbnail: '🔗',
    category: 'Best for Talking',
    players: '2-8 players',
    duration: '5-10 min',
    icon: Brain,
  },
  {
    id: 'truth-or-dare',
    name: 'Truth or Dare',
    description: 'Classic party game with fun questions and daring challenges.',
    thumbnail: '🎭',
    category: 'Party Games',
    players: '3-10 players',
    duration: '10-20 min',
    icon: Users,
  },
  {
    id: 'two-truths',
    name: 'Two Truths & A Lie',
    description: 'Share three statements about yourself - can your friends spot the lie?',
    thumbnail: '🤔',
    category: 'Best for Talking',
    players: '3-10 players',
    duration: '10-15 min',
    icon: Brain,
  },
];

interface GamesCarouselProps {
  onStartGame: (gameId: string) => void;
}

export default function GamesCarousel({ onStartGame }: GamesCarouselProps) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [scrollPositions, setScrollPositions] = useState<{ [key: string]: number }>({});

  const categories = Array.from(new Set(games.map((g) => g.category)));

  const scroll = (category: string, direction: 'left' | 'right') => {
    const container = document.getElementById(`carousel-${category}`);
    if (container) {
      const scrollAmount = 300;
      const newPosition =
        direction === 'left'
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="mb-2">Choose a Game</h2>
        <p className="text-gray-400">Pick a game to play with your friends</p>
      </motion.div>

      {/* Categories */}
      {categories.map((category, categoryIndex) => {
        const categoryGames = games.filter((g) => g.category === category);

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categoryIndex * 0.1 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-4">
              <h3>{category}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => scroll(category, 'left')}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll(category, 'right')}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              id={`carousel-${category}`}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
              style={{ scrollbarWidth: 'none' }}
            >
              {categoryGames.map((game, index) => {
                const Icon = game.icon;

                return (
                  <motion.button
                    key={game.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedGame(game)}
                    className="flex-shrink-0 w-72 group"
                  >
                    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/20 to-teal-900/20 border border-white/10 hover:border-purple-500/30 transition-all hover:scale-105">
                      {/* Thumbnail */}
                      <div className="h-40 bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-6xl relative z-10">{game.thumbnail}</span>
                        <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Icon className="w-5 h-5 text-purple-400" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 text-left">
                        <h4 className="mb-1">{game.name}</h4>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                          {game.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {game.players}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {game.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        );
      })}

      {/* Game Detail Modal */}
      <AnimatePresence>
        {selectedGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedGame(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-[#1a1625] to-[#2d1b3d] rounded-3xl border border-white/10 max-w-2xl w-full overflow-hidden"
            >
              {/* Header */}
              <div className="relative h-64 bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center">
                <span className="text-9xl">{selectedGame.thumbnail}</span>
                <button
                  onClick={() => setSelectedGame(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="mb-4">
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                    {selectedGame.category}
                  </span>
                </div>
                <h2 className="mb-3">{selectedGame.name}</h2>
                <p className="text-gray-300 mb-6">{selectedGame.description}</p>

                <div className="flex items-center gap-6 mb-8 text-gray-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>{selectedGame.players}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>{selectedGame.duration}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      onStartGame(selectedGame.id);
                      setSelectedGame(null);
                    }}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600"
                  >
                    Start Game
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedGame(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 border-white/10"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
