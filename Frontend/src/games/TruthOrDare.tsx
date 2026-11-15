import { RefreshCw } from 'lucide-react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { Button } from '../ui/Button';
import { GameHeader, PlayerChip, useMe, useName, type GameProps } from './common';

interface TodState extends BaseGameState {
  current: string | null;
  choice: 'truth' | 'dare' | null;
  prompt: string | null;
  rerolls: number;
  done: Record<string, { truth: number; dare: number }>;
  candidates: string[] | null;
  total_seconds: number | null;
}

export default function TruthOrDare({ state }: GameProps<TodState>) {
  const store = useRoomStore();
  const me = useMe();
  const name = useName();
  const mine = state.current === me;
  const who = mine ? 'You' : name(state.current ?? '');

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <GameHeader
        title={state.phase === 'SPIN' ? 'Spinning…' : `${who} ${mine ? 'are' : 'is'} in the hot seat`}
        deadlineAt={state.phase === 'SPIN' ? null : state.deadlineAt}
        total={state.total_seconds ? state.total_seconds * 1000 : undefined}
      />
      <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-line bg-panel p-6 text-center">
        {state.phase === 'SPIN' && (
          <div className="flex flex-wrap justify-center gap-2">
            {(state.candidates ?? []).map((p) => (
              <span key={p} className={p === state.current ? 'animate-pulse' : 'opacity-40'}><PlayerChip id={p} /></span>
            ))}
          </div>
        )}
        {state.phase === 'CHOOSE' && (mine ? (
          <>
            <p className="font-display text-2xl font-semibold">Truth or dare?</p>
            <div className="mt-6 flex gap-3">
              <Button size="lg" variant="secondary" onClick={() => store.gameAction('choose', { kind: 'truth' })}>Truth</Button>
              <Button size="lg" variant="primary" onClick={() => store.gameAction('choose', { kind: 'dare' })}>Dare</Button>
            </div>
          </>
        ) : <p className="text-lg text-muted">{who} is choosing…</p>)}
        {state.phase === 'PROMPT' && state.prompt && (
          <>
            <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">{state.choice}</span>
            <p className="mt-4 max-w-lg font-display text-2xl font-semibold leading-snug sm:text-3xl">{state.prompt}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {mine && state.rerolls > 0 && (
                <Button variant="ghost" onClick={() => store.gameAction('reroll')}><RefreshCw size={16} /> Different one</Button>
              )}
              <Button variant="primary" onClick={() => store.gameAction('done')}>{mine ? "I've done it" : 'They did it — next'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
