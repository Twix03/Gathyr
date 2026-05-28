import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../../App';
import { Button } from '../ui/button';
import { Palette, Eraser, RotateCcw, Send } from 'lucide-react';
import { websocketService } from '../../services/websocket';

interface ScribbleGameProps {
  participants: Participant[];
  currentUser: Participant;
  gameState: any;
}

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  lineWidth: number;
  isStart: boolean;
}

interface GuessMessage {
  playerId: string;
  playerName: string;
  guess: string;
  isCorrect: boolean;
  timestamp: number;
}

const colors = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFFFFF'
];

export default function ScribbleGame({ participants, currentUser, gameState }: ScribbleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [guessInput, setGuessInput] = useState('');
  const [guesses, setGuesses] = useState<GuessMessage[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showReveal, setShowReveal] = useState(false);
  const [revealWord, setRevealWord] = useState('');

  const isDrawer = gameState?.is_drawer || false;
  const word = gameState?.word || '';
  const scores = gameState?.scores || {};
  const drawerId = gameState?.drawer_id || '';
  const roundStartTime = gameState?.round_start_time;
  const roundEndTime = gameState?.round_end_time;
  const hasGuessed = gameState?.has_guessed || false;

  // Update countdown timer based on server timestamps
  useEffect(() => {
    if (!roundStartTime || !roundEndTime) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now() / 1000;
      const remaining = Math.max(0, Math.ceil(roundEndTime - now));
      setTimeLeft(remaining);

      if (remaining === 0) {
        websocketService.sendGameAction('ROUND_TIMEOUT', {});
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [roundStartTime, roundEndTime]);

  // Handle game events
  useEffect(() => {
    const handleGameEvent = (event: any) => {
      const { type, payload } = event;

      switch (type) {
        case 'DRAW_UPDATE':
          if (!isDrawer) {
            drawRemotePoint(payload);
          }
          break;

        case 'CANVAS_CLEAR':
          clearCanvas();
          break;

        case 'GUESS_CORRECT':
          const correctPlayer = participants.find(p => p.id === payload.player_id);
          if (correctPlayer) {
            setGuesses(prev => [...prev, {
              playerId: correctPlayer.id,
              playerName: correctPlayer.name,
              guess: '*** Guessed correctly! ***',
              isCorrect: true,
              timestamp: Date.now()
            }]);
          }
          
          if (payload.round_complete) {
            setShowReveal(true);
            setRevealWord(payload.word);
            setTimeout(() => {
              setShowReveal(false);
              websocketService.sendGameAction('NEXT_ROUND', {});
            }, 3000);
          }
          break;

        case 'GUESS_WRONG':
          const wrongPlayer = participants.find(p => p.id === payload.player_id);
          if (wrongPlayer) {
            setGuesses(prev => [...prev, {
              playerId: wrongPlayer.id,
              playerName: wrongPlayer.name,
              guess: payload.guess,
              isCorrect: false,
              timestamp: Date.now()
            }]);
          }
          break;

        case 'ROUND_TIMEOUT':
          setShowReveal(true);
          setRevealWord(payload.word);
          setTimeout(() => {
            setShowReveal(false);
            websocketService.sendGameAction('NEXT_ROUND', {});
          }, 3000);
          break;

        case 'ROUND_START':
          setGuesses([]);
          setShowReveal(false);
          clearCanvas();
          break;
      }
    };

    const unsubscribe = websocketService.on('game_event', (message) => {
      if (message.data) {
        handleGameEvent(message.data);
      }
    });

    return unsubscribe;
  }, [isDrawer, participants]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Load existing canvas data when game state updates
  useEffect(() => {
    if (gameState?.canvas_data && Array.isArray(gameState.canvas_data)) {
      clearCanvas();
      gameState.canvas_data.forEach((point: DrawPoint) => {
        drawRemotePoint(point);
      });
    }
  }, [gameState?.round_number]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  const drawPoint = (point: DrawPoint, isLocal: boolean = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const actualX = point.x * rect.width;
    const actualY = point.y * rect.height;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = point.lineWidth;
    ctx.strokeStyle = point.color;

    if (point.isStart) {
      ctx.beginPath();
      ctx.moveTo(actualX, actualY);
    } else {
      ctx.lineTo(actualX, actualY);
      ctx.stroke();
    }

    if (isLocal) {
      websocketService.sendGameAction('DRAW', {
        action: 'DRAW',
        ...point
      });
    }
  };

  const drawRemotePoint = (point: DrawPoint) => {
    drawPoint(point, false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    drawPoint({
      ...point,
      color: currentColor,
      lineWidth: lineWidth,
      isStart: true
    }, true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawing) return;
    const point = getCanvasPoint(e);
    drawPoint({
      ...point,
      color: currentColor,
      lineWidth: lineWidth,
      isStart: false
    }, true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearCanvas = () => {
    clearCanvas();
    websocketService.sendGameAction('DRAW', { action: 'CLEAR' });
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || hasGuessed) return;

    websocketService.sendGameAction('GUESS', {
      guess: guessInput.trim()
    });

    setGuessInput('');
  };

  const drawer = participants.find(p => p.id === drawerId);

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence>
        {showReveal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-8 rounded-3xl shadow-2xl text-center">
              <h2 className="text-4xl font-bold mb-4">The word was:</h2>
              <p className="text-6xl font-black">{revealWord}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-6 h-full">
        {/* Drawing Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="mb-1">Scribble</h2>
              {isDrawer ? (
                <p className="text-purple-400">Draw: <span className="font-bold text-2xl">{word}</span></p>
              ) : (
                <div>
                  <p className="text-gray-400">Guess: <span className="font-bold text-xl">{word}</span></p>
                  {drawer && <p className="text-sm text-gray-500">Artist: {drawer.name}</p>}
                </div>
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
                        className={`w-8 h-8 rounded-lg transition-transform ${currentColor === color ? 'ring-2 ring-purple-400 scale-110' : ''}`}
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
                  onClick={handleClearCanvas}
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

          {/* Guess Input */}
          {!isDrawer && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-4"
            >
              <form onSubmit={handleGuess} className="flex gap-2">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder={hasGuessed ? "You've already guessed!" : "Type your guess..."}
                  disabled={hasGuessed}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={!guessInput.trim() || hasGuessed}
                  className="px-6"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
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
                    {p.id === drawerId && <span className="text-xs text-purple-400">🎨</span>}
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
                  className={`p-2 rounded-lg ${g.isCorrect
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{g.playerName}:</span>
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
