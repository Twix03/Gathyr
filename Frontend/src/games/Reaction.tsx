import { useEffect, useRef } from 'react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { cn } from '../ui/cn';
import { GameHeader, PlayerChip, Scoreboard, type GameProps } from './common';

interface ReactionState extends BaseGameState {
  round: number;
  rounds: number;
  my_time: number | null;
  tapped: boolean;
  false_start: boolean;
  results: { id: string; ms: number | null }[] | null;
  best: Record<string, number>;
}

export default function Reaction({ state }: GameProps<ReactionState>) {
  const store = useRoomStore();
  const greenAt = useRef<number | null>(null);

  // Measure from the frame green is painted, on this device — network lag doesn't count.
  useEffect(() => {
    if (state.phase !== 'GO') { greenAt.current = null; return; }
    const raf = requestAnimationFrame(() => { greenAt.current = performance.now(); });
    return () => cancelAnimationFrame(raf);
  }, [state.phase, state.round]);

  const tap = () => {
    if (state.tapped) return;
    const ms = state.phase === 'GO' && greenAt.current != null ? Math.round(performance.now() - greenAt.current) : undefined;
    store.gameAction('tap', ms ? { ms } : {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pad = state.phase === 'GO' && !state.tapped ? 'bg-good text-ink'
    : state.false_start ? 'bg-bad/20 text-bad'
      : state.phase === 'WAIT' ? 'bg-bad text-white'
        : 'bg-panel text-text';
  const label = state.false_start ? 'Too early! Wait for green next time.'
    : state.phase === 'WAIT' ? 'Wait for green…'
      : state.phase === 'GO' ? (state.tapped ? `${state.my_time ?? '—'} ms` : 'TAP!')
        : state.my_time ? `${state.my_time} ms` : 'Round over';

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <GameHeader title={`Round ${state.round} of ${state.rounds}`} subtitle="Tap the pad (or press space) the moment it turns green." />
        <button type="button" onPointerDown={tap}
          className={cn('flex min-h-64 flex-1 select-none items-center justify-center rounded-3xl font-display text-3xl font-bold transition-colors duration-75 touch-manipulation sm:text-5xl', pad)}>
          {label}
        </button>
        {state.phase === 'RESULT' && state.results && (
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {state.results.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><span className="w-4 font-mono text-muted">{i + 1}</span><PlayerChip id={r.id} /></span>
                <span className={cn('font-mono tabular', r.ms == null && 'text-bad')}>{r.ms == null ? 'false start' : `${r.ms} ms`}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Scoreboard scores={state.scores} className="lg:w-64 shrink-0 self-start w-full" />
    </div>
  );
}
