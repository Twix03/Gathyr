import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eraser, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { cn } from '../ui/cn';
import { GameHeader, PlayerChip, Scoreboard, useMe, useName, type GameProps } from './common';

interface ScribbleState extends BaseGameState {
  round: number;
  rounds: number;
  drawer: string | null;
  choices: string[] | null;
  word: string | null;
  mask: string;
  guessed: string[];
  turn_points: Record<string, number> | null;
  total_seconds: number | null;
}

interface Segment { s: number; c: string; w: number; p: number[] }
interface FeedItem { id: number; pid: string; text?: string; correct?: boolean; close?: boolean }

const COLORS = ['#111111', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#8b5a2b'];
const SIZES = [3, 7, 14, 28];
const PAPER = '#ffffff';
const FLUSH_MS = 40;

export default function Scribble({ state }: GameProps<ScribbleState>) {
  const store = useRoomStore();
  const me = useMe();
  const name = useName();
  const isDrawer = state.drawer === me;
  const canDraw = isDrawer && state.phase === 'DRAWING';
  const turnKey = `${state.round}:${state.drawer}`;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const feedId = useRef(0);
  useEffect(() => { setFeed([]); }, [turnKey]);

  const segments = useRef<Segment[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ---- rendering
  const drawSegment = useCallback((seg: Segment) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.strokeStyle = seg.c;
    ctx.fillStyle = seg.c;
    ctx.lineWidth = (seg.w * W) / 800;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const p = seg.p;
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(p[0] * W, p[1] * H, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0] * W, p[1] * H);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * W, p[i + 1] * H);
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    segments.current.forEach(drawSegment);
  }, [drawSegment]);

  // keep a 4:3 canvas that fills the available space, crisp at any DPR
  useLayoutEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = box.getBoundingClientRect();
      const w = Math.max(100, Math.min(width, (height * 4) / 3));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${(w * 3) / 4}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(((w * 3) / 4) * dpr);
      redraw();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // ---- server events (ask for the current canvas once we're listening)
  useEffect(() => {
    const off = store.onGameEvent(handleEvent);
    store.gameAction('sync');
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  function handleEvent(e: { type: string; payload: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (e.type === 'stroke') {
      segments.current.push(e.payload);
      drawSegment(e.payload);
    } else if (e.type === 'canvas') {
      segments.current = e.payload.strokes ?? [];
      redraw();
    } else if (e.type === 'guess') {
      setFeed((f) => [...f.slice(-60), { id: ++feedId.current, ...e.payload }]);
    }
  }

  // ---- local drawing
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const strokeId = useRef(0);
  const pending = useRef<{ seg: Segment; sentUpTo: number } | null>(null);
  const flushTimer = useRef<number | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const cur = pending.current;
    if (!cur) return;
    const unsent = cur.seg.p.slice(Math.max(0, cur.sentUpTo - 2)); // overlap last point so lines connect
    if (unsent.length >= 2 && cur.seg.p.length > cur.sentUpTo) {
      store.gameAction('stroke', { s: cur.seg.s, c: cur.seg.c, w: cur.seg.w, p: unsent.map((v) => Math.round(v * 10000) / 10000) });
      cur.sentUpTo = cur.seg.p.length;
    }
  }, [store]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const seg: Segment = { s: ++strokeId.current, c: tool === 'eraser' ? PAPER : color, w: tool === 'eraser' ? size * 2 : size, p: point(e) };
    pending.current = { seg, sentUpTo: 0 };
    drawSegment(seg);
    flush();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = pending.current;
    if (!cur || !canDraw) return;
    const [x, y] = point(e);
    const p = cur.seg.p;
    if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 0.002) return;
    drawSegment({ ...cur.seg, p: [p[p.length - 2], p[p.length - 1], x, y] });
    p.push(x, y);
    if (!flushTimer.current) flushTimer.current = window.setTimeout(flush, FLUSH_MS);
  };
  const onUp = () => {
    const cur = pending.current;
    if (!cur) return;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flush();
    segments.current.push(cur.seg);
    pending.current = null;
  };

  const undo = () => {
    // optimistic local undo; the server broadcasts the authoritative canvas
    const last = segments.current[segments.current.length - 1]?.s;
    segments.current = segments.current.filter((s) => s.s !== last);
    redraw();
    store.gameAction('undo');
  };
  const clear = () => {
    segments.current = [];
    redraw();
    store.gameAction('clear');
  };

  // ---- guessing
  const [guess, setGuess] = useState('');
  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    store.gameAction('guess', { text: guess.trim() });
    setGuess('');
  };
  const iGuessed = state.guessed.includes(me);

  const title = state.phase === 'CHOOSING'
    ? (isDrawer ? 'Pick a word to draw' : `${name(state.drawer ?? '')} is choosing a word…`)
    : state.phase === 'REVEAL' ? <>The word was <span className="text-accent">{state.word}</span></>
      : isDrawer ? <>Draw: <span className="text-accent">{state.word}</span></>
        : iGuessed ? <>You got it: <span className="text-good">{state.word}</span></>
          : <span className="font-mono tracking-[0.35em]">{state.mask}</span>;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <GameHeader
        title={title}
        subtitle={`Round ${state.round} of ${state.rounds}${state.phase === 'DRAWING' && !isDrawer && !iGuessed
          ? ` · ${state.mask.replace(/[^_]/g, '').length} letters` : ''}`}
        deadlineAt={state.deadlineAt}
        total={state.total_seconds ? state.total_seconds * 1000 : undefined}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div ref={boxRef} className="relative flex min-h-[220px] flex-1 items-center justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={cn('rounded-xl shadow-pop touch-none', canDraw ? 'cursor-crosshair' : 'cursor-default')}
            />
            {state.phase === 'CHOOSING' && isDrawer && state.choices && (
              <Overlay>
                <p className="mb-3 text-sm text-muted">Choose one to draw</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {state.choices.map((w, i) => (
                    <button key={w} type="button" onClick={() => store.gameAction('choose', { index: i })}
                      className="rounded-xl bg-accent px-4 py-2.5 font-display font-semibold capitalize text-accent-ink hover:bg-accent-hover">
                      {w}
                    </button>
                  ))}
                </div>
              </Overlay>
            )}
            {state.phase === 'REVEAL' && state.turn_points && (
              <Overlay>
                <p className="font-display text-2xl font-bold capitalize">{state.word}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {Object.entries(state.turn_points).sort((a, b) => b[1] - a[1]).map(([pid, pts]) => (
                    <li key={pid} className="flex justify-between gap-6">
                      <PlayerChip id={pid} suffix={pid === state.drawer ? <Pencil size={12} className="text-muted" /> : null} />
                      <span className="font-mono tabular text-good">+{pts}</span>
                    </li>
                  ))}
                  {Object.keys(state.turn_points).length <= 1 && <li className="text-muted">Nobody got it this time.</li>}
                </ul>
              </Overlay>
            )}
          </div>

          {canDraw && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-line bg-panel p-2">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { setColor(c); setTool('pen'); }}
                    className={cn('size-7 rounded-full border border-line-strong',
                      tool === 'pen' && color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-panel')}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="mx-1 h-6 w-px bg-line" />
              {SIZES.map((s) => (
                <button key={s} type="button" aria-label={`Brush ${s}`} onClick={() => setSize(s)}
                  className={cn('size-8 inline-flex items-center justify-center rounded-lg', size === s ? 'bg-raised' : 'hover:bg-raised')}>
                  <span className="rounded-full bg-text" style={{ width: Math.max(4, s / 1.4), height: Math.max(4, s / 1.4) }} />
                </button>
              ))}
              <div className="mx-1 h-6 w-px bg-line" />
              <ToolButton label="Eraser" active={tool === 'eraser'} onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}><Eraser size={16} /></ToolButton>
              <ToolButton label="Undo" onClick={undo}><Undo2 size={16} /></ToolButton>
              <ToolButton label="Clear" onClick={clear}><Trash2 size={16} /></ToolButton>
            </div>
          )}
        </div>

        <div className="flex min-h-48 shrink-0 flex-col gap-3 lg:w-72">
          <Scoreboard scores={state.scores} highlight={state.guessed} />
          <div className="flex min-h-40 flex-1 flex-col rounded-2xl border border-line bg-panel">
            <Feed feed={feed} />
            {!isDrawer && (
              <form onSubmit={submitGuess} className="flex gap-2 border-t border-line p-2">
                <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={60}
                  disabled={state.phase !== 'DRAWING'}
                  placeholder={iGuessed ? 'Chat with others who got it' : state.phase === 'DRAWING' ? 'Type your guess' : 'Wait for the drawing…'}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-raised border border-line px-3 text-sm placeholder:text-faint focus:outline-none focus:border-line-strong disabled:opacity-50" />
                <button type="submit" aria-label="Send guess" disabled={!guess.trim() || state.phase !== 'DRAWING'}
                  className="size-10 inline-flex items-center justify-center rounded-lg bg-accent text-accent-ink disabled:opacity-30">
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feed({ feed }: { feed: FeedItem[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [feed.length]);
  const name = useName();
  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 text-sm">
      {feed.length === 0 && <p className="text-faint">Guesses show up here.</p>}
      {feed.map((f) => (
        <p key={f.id} className={cn(f.correct && 'font-semibold text-good', f.close && 'text-warn')}>
          {f.correct ? `${name(f.pid)} guessed the word!`
            : f.close ? `“${f.text}” is close!`
              : <><span className="font-medium text-muted">{name(f.pid)}:</span> {f.text}</>}
        </p>
      ))}
      <div ref={end} />
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-line bg-panel/95 p-5 text-center shadow-pop animate-pop-in">{children}</div>
    </div>
  );
}

function ToolButton({ label, onClick, active, children }: {
  label: string; onClick: () => void; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn('size-8 inline-flex items-center justify-center rounded-lg', active ? 'bg-text text-ink' : 'text-muted hover:bg-raised hover:text-text')}>
      {children}
    </button>
  );
}
