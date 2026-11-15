import { Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useParticipantMap, useRoom, useRoomStore } from '../lib/roomStore';
import type { BaseGameState, LeaderboardRow } from '../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Countdown } from '../ui/Countdown';
import { cn } from '../ui/cn';

export interface GameProps<T extends BaseGameState = BaseGameState> {
  state: T;
}

export function useMe(): string {
  return useRoom((s) => s.me);
}

export function useName(): (id: string) => string {
  const people = useParticipantMap();
  return (id: string) => people.get(id)?.name ?? 'Someone';
}

export function PlayerChip({ id, className, suffix }: { id: string; className?: string; suffix?: ReactNode }) {
  const people = useParticipantMap();
  const me = useMe();
  const p = people.get(id);
  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      <Avatar name={p?.name ?? '?'} color={p?.color} size={20} />
      <span className="truncate font-medium">{id === me ? 'You' : p?.name ?? 'Someone'}</span>
      {suffix}
    </span>
  );
}

export function GameHeader({ title, subtitle, deadlineAt, total, right }: {
  title: ReactNode; subtitle?: ReactNode; deadlineAt?: number | null; total?: number; right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}
        <Countdown deadlineAt={deadlineAt} total={total} />
      </div>
    </div>
  );
}

export function Scoreboard({ scores, highlight, className }: {
  scores: Record<string, number>; highlight?: string[]; className?: string;
}) {
  const people = useParticipantMap();
  const rows = Object.entries(scores).filter(([id]) => people.has(id)).sort((a, b) => b[1] - a[1]);
  return (
    <div className={cn('rounded-2xl border border-line bg-panel p-3', className)}>
      <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">Scores</h3>
      <ol className="space-y-1">
        {rows.map(([id, score]) => (
          <li key={id} className={cn('flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm',
            highlight?.includes(id) && 'bg-good/10')}>
            <PlayerChip id={id} />
            <span className="font-mono tabular font-semibold">{score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Results({ rows, deadlineAt }: { rows: LeaderboardRow[]; deadlineAt: number | null }) {
  const store = useRoomStore();
  const me = useMe();
  const top = rows[0]?.score ?? 0;
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center p-6 text-center">
      <Trophy size={40} className="text-warn" />
      <h2 className="mt-3 font-display text-2xl font-bold">
        {rows.length === 0 ? 'Game over' : rows.filter((r) => r.score === top).length > 1 ? "It's a tie!"
          : rows[0].id === me ? 'You win!' : `${rows[0].name} wins!`}
      </h2>
      <ol className="mt-6 w-full space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className={cn('flex items-center gap-3 rounded-xl border border-line px-3 py-2.5',
            i === 0 ? 'bg-warn/10 border-warn/30' : 'bg-panel')}>
            <span className="w-5 text-sm font-mono text-muted tabular">{i + 1}</span>
            <span className="flex-1 truncate text-left font-medium">{r.id === me ? `${r.name} (you)` : r.name}</span>
            <span className="font-mono tabular font-semibold">{r.score}</span>
          </li>
        ))}
      </ol>
      <Button variant="primary" className="mt-6" onClick={() => store.gameAction('return_to_lobby')}>
        Back to the room
      </Button>
      <Countdown deadlineAt={deadlineAt} className="mt-3 justify-center" />
    </div>
  );
}
