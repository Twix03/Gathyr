import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useRoomStore } from '../lib/roomStore';
import type { BaseGameState } from '../lib/types';
import { cn } from '../ui/cn';
import { GameHeader, PlayerChip, useMe, useName, type GameProps } from './common';

interface WordChainState extends BaseGameState {
  chain: { word: string; pid: string | null }[];
  letter: string;
  current: string | null;
  order: string[];
  lives: Record<string, number>;
  max_lives: number;
  last_event: { type: 'word' | 'timeout'; pid: string; word?: string; out?: boolean } | null;
  total_seconds: number;
}

export default function WordChain({ state }: GameProps<WordChainState>) {
  const store = useRoomStore();
  const me = useMe();
  const name = useName();
  const myTurn = state.current === me;
  const [word, setWord] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const chainEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { if (myTurn) { setWord(state.letter); input.current?.focus(); } }, [myTurn, state.letter, state.chain.length]);
  useEffect(() => { chainEnd.current?.scrollIntoView({ inline: 'end', block: 'nearest' }); }, [state.chain.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim().length >= 3) store.gameAction('word', { word: word.trim() });
  };

  const ev = state.last_event;
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <GameHeader
        title={myTurn ? <>Your turn — starts with <span className="text-accent">{state.letter.toUpperCase()}</span></>
          : <>{name(state.current ?? '')}'s turn</>}
        subtitle={ev?.type === 'timeout' ? `${name(ev.pid)} ran out of time${ev.out ? ' and is out' : ''}.`
          : 'Each word starts with the last letter of the one before.'}
        deadlineAt={state.deadlineAt}
        total={state.total_seconds * 1000}
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
        {state.chain.map((c, i) => (
          <span key={i} className={cn('shrink-0 rounded-xl border px-3 py-2 font-display text-lg',
            i === state.chain.length - 1 ? 'border-accent bg-accent/10' : 'border-line bg-panel text-muted')}>
            {c.word.slice(0, -1)}<span className={cn(i === state.chain.length - 1 && 'text-accent font-bold')}>{c.word.slice(-1)}</span>
          </span>
        ))}
        <div ref={chainEnd} />
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input ref={input} value={word} disabled={!myTurn} maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false}
          onChange={(e) => setWord(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
          placeholder={myTurn ? '' : 'Wait for your turn'}
          className="input font-display text-xl disabled:opacity-50" />
        <button type="submit" disabled={!myTurn || word.length < 3}
          className="h-12 rounded-xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-30">Play</button>
      </form>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {state.order.map((pid) => {
          const lives = state.lives[pid] ?? 0;
          return (
            <li key={pid} className={cn('flex items-center justify-between rounded-xl border px-3 py-2',
              pid === state.current ? 'border-accent bg-accent/5' : 'border-line bg-panel', lives <= 0 && 'opacity-40')}>
              <PlayerChip id={pid} suffix={lives <= 0 ? <span className="text-xs text-bad">out</span> : null} />
              <span className="flex items-center gap-3">
                <span className="flex gap-0.5">
                  {Array.from({ length: state.max_lives }).map((_, i) => (
                    <Heart key={i} size={14} className={i < lives ? 'fill-bad text-bad' : 'text-faint'} />
                  ))}
                </span>
                <span className="w-10 text-right font-mono text-sm tabular">{state.scores[pid] ?? 0}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
