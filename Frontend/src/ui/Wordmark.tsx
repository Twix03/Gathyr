import { cn } from './cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-lg font-bold tracking-tight select-none', className)}>
      gathyr<span className="text-accent">.</span>
    </span>
  );
}
