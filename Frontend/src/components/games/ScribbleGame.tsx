import { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Palette, Eraser, RotateCcw } from 'lucide-react';

interface ScribbleGameProps {
  participants: Participant[];
  currentUser: Participant;
}

const words = [
  'Cat', 'House', 'Tree', 'Sun', 'Car', 'Phone', 'Book', 'Pizza',
  'Guitar', 'Mountain', 'Ocean', 'Rainbow', 'Butterfly', 'Coffee'
];

const colors = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFFFFF'
];

export default function ScribbleGame({ participants, currentUser }: ScribbleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [currentWord, setCurrentWord] = useState(words[Math.floor(Math.random() * words.length)]);
  const [isDrawer, setIsDrawer] = useState(currentUser.id === participants[0].id);
  const [guesses, setGuesses] = useState<{ participant: Participant; guess: string }[]>([]);
  const [scores, setScores] = useState<{ [key: string]: number }>(
    Object.fromEntries(participants.map(p => [p.id, 0]))
  );
  const [timeLeft, setTimeLeft] = useState(60);

  // Timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Round ends, switch drawer
      nextRound();
    }
  }, [timeLeft]);

  // Simulate guesses from other players
  useEffect(() => {
    if (!isDrawer && timeLeft > 30 && timeLeft % 8 === 0) {
      const otherPlayers = participants.filter(p => p.id !== currentUser.id && p.id !== participants[0].id);
      if (otherPlayers.length > 0) {
        const randomPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        const wrongGuesses = ['Dog', 'Ball', 'Star', 'Cloud', 'Fish'];
        addGuess(randomPlayer, wrongGuesses[Math.floor(Math.random() * wrongGuesses.length)]);
      }
    }
  }, [timeLeft]);

  const nextRound = () => {
    setTimeLeft(60);
    setCurrentWord(words[Math.floor(Math.random() * words.length)]);
    clearCanvas();
    setGuesses([]);
  };

  const addGuess = (participant: Participant, guess: string) => {
    setGuesses(prev => [...prev, { participant, guess }]);
    if (guess.toLowerCase() === currentWord.toLowerCase()) {
      setScores(prev => ({ ...prev, [participant.id]: (prev[participant.id] || 0) + 100 }));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    if (!isDrawing && e.type !== 'mousedown') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = currentColor;

    if (e.type === 'mousedown') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set actual pixel size
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Normalize drawing operations
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear after resize
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-900/10 to-teal-900/10 p-6">
      <div className="flex gap-6 h-full">
        {/* Drawing Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="mb-1">Scribble</h2>
              {isDrawer ? (
                <p className="text-purple-400">Draw: <span className="font-bold">{currentWord}</span></p>
              ) : (
                <p className="text-gray-400">Guess what's being drawn!</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-400">{timeLeft}s</div>
              <div className="text-sm text-gray-400">Time left</div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 rounded-2xl overflow-hidden bg-white shadow-2xl min-h-0">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className={`w-full h-full ${isDrawer ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
            />
          </div>

          {/* Drawing Tools */}
          {isDrawer && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Colors:</span>
                  <div className="flex gap-1 flex-wrap">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setCurrentColor(color)}
                        className={`w-8 h-8 rounded-lg transition-transform ${currentColor === color ? 'ring-2 ring-purple-400 scale-110' : ''
                          }`}
                        style={{ backgroundColor: color, border: color === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Size:</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="w-24"
                  />
                </div>

                <Button
                  onClick={clearCanvas}
                  variant="outline"
                  size="sm"
                  className="bg-white/5 border-white/10"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 flex flex-col gap-4 shrink-0">
          {/* Scores */}
          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <h3 className="mb-3">Scores</h3>
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full" />
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <span className="text-purple-400 font-bold">{scores[p.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Guesses */}
          <div className="flex-1 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-auto min-h-0">
            <h3 className="mb-3">Guesses</h3>
            <div className="space-y-2">
              {guesses.map((g, i) => (
                <motion.div
                  key={i}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`p-2 rounded-lg ${g.guess.toLowerCase() === currentWord.toLowerCase()
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <img src={g.participant.avatar} alt={g.participant.name} className="w-5 h-5 rounded-full" />
                    <span className="text-sm">{g.participant.name}:</span>
                    <span className="text-sm text-gray-300">{g.guess}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}