import { useState } from 'react';
import { Check } from 'lucide-react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { GameHeader, PlayerChip, Scoreboard, useMe, useName, type GameProps } from './common';

interface TwoTruthsState extends BaseGameState {
  submitted: string[];
  my_entry: { statements: string[]; lie: number } | null;
  author: string | null;
  statements: string[] | null;
  my_vote: number | null;
  voted: string[];
  lie: number | null;
  tally: number[] | null;
  round_points: Record<string, number> | null;
  remaining_authors: number;
  total_seconds: number | null;
}

export default function TwoTruths({ state }: GameProps<TwoTruthsState>) {
  return state.phase === 'WRITE' ? <Write state={state} /> : <Vote state={state} />;
}

function Write({ state }: { state: TwoTruthsState }) {
  const store = useRoomStore();
  const [lines, setLines] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  const ready = lines.every((l) => l.trim()) && lie !== null;

  return (
    <div className="mx-auto max-w-2xl">
      <GameHeader title="Write two truths and one lie"
        subtitle={`${state.submitted.length} ready`} deadlineAt={state.deadlineAt}
        total={state.total_seconds ? state.total_seconds * 1000 : undefined} />
      {state.my_entry ? (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="font-semibold text-good">You're in. Waiting for the others…</p>
          <ol className="mt-3 space-y-1.5 text-sm">
            {state.my_entry.statements.map((s, i) => (
              <li key={i} className={cn(i === state.my_entry!.lie && 'text-bad')}>{s}{i === state.my_entry!.lie && ' (lie)'}</li>
            ))}
          </ol>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (ready) store.gameAction('submit', { statements: lines, lie }); }}
          className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={l} maxLength={140} placeholder={['Something true about you', 'Another true thing', 'A believable lie'][i]}
                onChange={(e) => setLines((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                className="input" />
              <button type="button" onClick={() => setLie(i)} aria-pressed={lie === i}
                className={cn('h-12 shrink-0 rounded-xl border px-3 text-sm font-semibold',
                  lie === i ? 'border-bad bg-bad/15 text-bad' : 'border-line text-muted hover:text-text')}>
                Lie
              </button>
            </div>
          ))}
          <Button type="submit" variant="primary" size="lg" disabled={!ready} className="w-full">Lock it in</Button>
        </form>
      )}
    </div>
  );
}

function Vote({ state }: { state: TwoTruthsState }) {
  const store = useRoomStore();
  const me = useMe();
  const name = useName();
  const isAuthor = state.author === me;
  const revealing = state.phase === 'REVEAL';
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <GameHeader
          title={isAuthor ? 'Can they spot your lie?' : `Which one is ${name(state.author ?? '')}'s lie?`}
          subtitle={revealing ? undefined : `${state.voted.length} voted`}
          deadlineAt={state.deadlineAt}
          total={state.total_seconds ? state.total_seconds * 1000 : undefined}
        />
        <div className="space-y-2.5">
          {state.statements?.map((s, i) => {
            const isLie = revealing && state.lie === i;
            const mine = state.my_vote === i;
            return (
              <button key={i} type="button" disabled={isAuthor || revealing}
                onClick={() => store.gameAction('vote', { index: i })}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-4 text-left text-lg transition-colors',
                  isLie ? 'border-bad bg-bad/10' : mine ? 'border-accent bg-accent/10' : 'border-line bg-panel enabled:hover:bg-raised',
                  revealing && !isLie && 'opacity-60')}>
                <span className="flex-1">{s}</span>
                {revealing && <span className="font-mono text-sm text-muted tabular">{state.tally?.[i] ?? 0} votes</span>}
                {isLie && <span className="text-sm font-semibold text-bad">LIE</span>}
                {mine && !revealing && <Check size={18} className="text-accent" />}
              </button>
            );
          })}
        </div>
        {revealing && state.round_points && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(state.round_points).map(([pid, pts]) => (
              <span key={pid} className="inline-flex items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 text-sm">
                <PlayerChip id={pid} /> <span className="font-mono text-good">+{pts}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <Scoreboard scores={state.scores} className="lg:w-64 shrink-0 self-start w-full" />
    </div>
  );
}
