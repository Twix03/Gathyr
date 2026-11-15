import { useEffect, useState } from 'react';
import { msLeft } from '../lib/time';
import { cn } from './cn';

/** Re-renders a few times a second while a deadline is running. */
export function useCountdown(deadlineAt: number | null | undefined, intervalMs = 250): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (deadlineAt == null) return;
    const id = setInterval(() => force((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [deadlineAt, intervalMs]);
  return msLeft(deadlineAt);
}

export function Countdown({ deadlineAt, total, className }: {
  deadlineAt: number | null | undefined; total?: number; className?: string;
}) {
  const left = useCountdown(deadlineAt);
  if (deadlineAt == null) return null;
  const secs = Math.ceil(left / 1000);
  const urgent = secs <= 5;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {total ? (
        <div className="h-1.5 w-24 rounded-full bg-raised overflow-hidden">
          <div className={cn('h-full rounded-full', urgent ? 'bg-bad' : 'bg-accent')}
            style={{ width: `${Math.min(100, (left / total) * 100)}%`, transition: 'width 250ms linear' }} />
        </div>
      ) : null}
      <span className={cn('font-mono text-sm tabular', urgent ? 'text-bad' : 'text-muted')}>{secs}s</span>
    </div>
  );
}
