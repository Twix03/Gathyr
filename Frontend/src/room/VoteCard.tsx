import { Check, X } from 'lucide-react';
import { useParticipantMap, useRoom, useRoomStore } from '../lib/roomStore';
import { Countdown } from '../ui/Countdown';
import { cn } from '../ui/cn';

export function VoteCard() {
  const store = useRoomStore();
  const proposal = useRoom((s) => s.room.proposal);
  const me = useRoom((s) => s.me);
  const online = useRoom((s) => s.room.participants.filter((p) => p.connected).length);
  const people = useParticipantMap();
  if (!proposal) return null;

  const mine = proposal.votes[me];
  const yes = Object.values(proposal.votes).filter(Boolean).length;
  const no = Object.values(proposal.votes).filter((v) => !v).length;
  const proposer = people.get(proposal.proposer_id)?.name ?? 'Someone';
  const ending = proposal.type === 'END';

  return (
    <div role="dialog" aria-label="Vote"
      className="fixed z-40 bottom-24 left-1/2 -translate-x-1/2 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-line bg-panel shadow-pop p-4 animate-pop-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{proposal.proposer_id === me ? 'You' : proposer} {ending ? 'wants to end' : 'wants to play'}</p>
          <p className="font-display text-lg font-semibold">{proposal.game_name}</p>
        </div>
        <Countdown deadlineAt={proposal.deadlineAt} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <VoteButton chosen={mine === true} onClick={() => store.send('vote', { vote: true })} tone="yes">
          <Check size={16} /> {ending ? 'End it' : "I'm in"} <span className="tabular opacity-70">{yes}</span>
        </VoteButton>
        <VoteButton chosen={mine === false} onClick={() => store.send('vote', { vote: false })} tone="no">
          <X size={16} /> {ending ? 'Keep playing' : 'Not now'} <span className="tabular opacity-70">{no}</span>
        </VoteButton>
      </div>
      <p className="mt-2 text-xs text-faint">{proposal.rule} · {online} {online === 1 ? 'person' : 'people'} here</p>
    </div>
  );
}

function VoteButton({ chosen, tone, onClick, children }: {
  chosen: boolean; tone: 'yes' | 'no'; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={chosen}
      className={cn('h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors',
        chosen
          ? tone === 'yes' ? 'bg-good text-ink border-good' : 'bg-bad text-white border-bad'
          : 'bg-raised border-line hover:bg-hover')}>
      {children}
    </button>
  );
}
