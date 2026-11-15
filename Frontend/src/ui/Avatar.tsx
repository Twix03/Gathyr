import { cn } from './cn';

export const PLAYER_COLORS = ['#ff7043', '#5b8def', '#3dd68c', '#f5b841', '#c77dff', '#2ec4b6', '#ff5c8a', '#9aa5b1'];

export function playerColor(index: number | undefined): string {
  return PLAYER_COLORS[((index ?? 7) % PLAYER_COLORS.length + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, color, size = 32, className, dimmed }: {
  name: string; color?: number; size?: number; className?: string; dimmed?: boolean;
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink select-none',
        dimmed && 'opacity-40', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: playerColor(color) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
