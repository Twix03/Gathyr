import { Users, Clock } from 'lucide-react';
import { GAMES } from '../games/catalog';
import { useRoom, useRoomStore } from '../lib/roomStore';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function GameLibrary({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useRoomStore();
  const online = useRoom((s) => s.room.participants.filter((p) => p.connected).length);
  const voting = useRoom((s) => !!s.room.proposal);
  const lastPlayed = useRoom((s) => s.room.last_played);

  const propose = (id: string) => {
    store.send('propose', { type: 'START', game_id: id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Pick a game"
      description="Everyone gets a vote before it starts." className="w-[min(720px,calc(100vw-32px))]">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {GAMES.map((g) => {
          const Icon = g.icon;
          const tooFew = online < g.minPlayers;
          return (
            <div key={g.id} className="flex flex-col rounded-xl border border-line bg-raised/60 p-4">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-xl inline-flex items-center justify-center"
                  style={{ background: `${g.color}22`, color: g.color }}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <div className="font-display font-semibold flex items-center gap-2">
                    {g.name}
                    {lastPlayed === g.id && <span className="text-[10px] uppercase tracking-wide text-faint">last played</span>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><Users size={12} />{g.players}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} />{g.length}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted mt-3 flex-1">{g.tagline}</p>
              <Button className="mt-3" variant="secondary" size="sm"
                disabled={tooFew || voting} onClick={() => propose(g.id)}>
                {tooFew ? `Needs ${g.minPlayers}+ players` : voting ? 'Vote in progress' : 'Propose'}
              </Button>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
