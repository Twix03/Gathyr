import { Check } from 'lucide-react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { cn } from '../ui/cn';
import { GameHeader, PlayerChip, Scoreboard, useMe, type GameProps } from './common';

interface TriviaState extends BaseGameState {
  number: number;
  total: number;
  category: string | null;
  question: string | null;
  options: string[] | null;
  my_answer: number | null;
  answered: string[];
  correct: number | null;
  choices: Record<string, number> | null;
  gained: Record<string, number> | null;
  total_seconds: number | null;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Trivia({ state }: GameProps<TriviaState>) {
  const store = useRoomStore();
  const me = useMe();

  if (state.phase === 'READY') {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-muted">Get ready</p>
        <p className="mt-2 font-display text-3xl font-bold">{state.total} questions, 15 seconds each</p>
        <p className="mt-2 text-sm text-faint">Faster correct answers score more.</p>
      </div>
    );
  }

  const revealing = state.phase === 'REVEAL';
  const pickers = (i: number) => Object.entries(state.choices ?? {}).filter(([, c]) => c === i).map(([p]) => p);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <GameHeader
          title={`Question ${state.number} of ${state.total}`}
          subtitle={state.category ?? undefined}
          deadlineAt={state.deadlineAt}
          total={state.total_seconds ? state.total_seconds * 1000 : undefined}
          right={!revealing && <span className="text-sm text-muted tabular">{state.answered.length} answered</span>}
        />
        <p className="font-display text-2xl font-semibold leading-snug sm:text-3xl">{state.question}</p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {state.options?.map((opt, i) => {
            const mine = state.my_answer === i;
            const right = revealing && state.correct === i;
            const wrong = revealing && mine && state.correct !== i;
            return (
              <button key={i} type="button" disabled={state.my_answer !== null || revealing}
                onClick={() => store.gameAction('answer', { index: i })}
                className={cn('flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  right ? 'border-good bg-good/15' : wrong ? 'border-bad bg-bad/10'
                    : mine ? 'border-accent bg-accent/10' : 'border-line bg-panel enabled:hover:bg-raised',
                  revealing && !right && !mine && 'opacity-50')}>
                <span className={cn('size-8 shrink-0 rounded-lg inline-flex items-center justify-center font-mono text-sm font-semibold',
                  right ? 'bg-good text-ink' : mine ? 'bg-accent text-accent-ink' : 'bg-raised text-muted')}>
                  {right ? <Check size={16} /> : LETTERS[i]}
                </span>
                <span className="flex-1 font-medium">{opt}</span>
                {revealing && (
                  <span className="flex -space-x-1">
                    {pickers(i).slice(0, 5).map((p) => <PlayerChip key={p} id={p} className="[&>span:last-child]:hidden" />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {revealing && (
          <p className="mt-4 text-sm text-muted">
            {state.gained?.[me] ? <span className="font-semibold text-good">+{state.gained[me]} points</span>
              : state.my_answer === null ? "You didn't answer." : 'Not this time.'}
          </p>
        )}
      </div>
      <Scoreboard scores={state.scores} highlight={revealing ? Object.keys(state.gained ?? {}) : state.answered}
        className="lg:w-64 shrink-0 self-start w-full" />
    </div>
  );
}
