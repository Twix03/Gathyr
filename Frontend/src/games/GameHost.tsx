import { useRoom } from '../lib/roomStore';
import { usePrefs } from '../lib/prefs';
import type { MediaParticipant } from '../media/useMediaParticipants';
import { VideoStrip } from '../room/Stage';
import { cn } from '../ui/cn';
import { Results } from './common';
import { GAME_COMPONENTS } from './index';

export function GameHost({ participants, colors }: {
  participants: MediaParticipant[]; colors: Map<string, number>;
}) {
  const game = useRoom((s) => s.game);
  const roomGame = useRoom((s) => s.room.game);
  const { stripPosition } = usePrefs();
  const Component = roomGame ? GAME_COMPONENTS[roomGame.id] : undefined;
  const side = stripPosition === 'right';

  let body: React.ReactNode;
  if (!game || !roomGame || game.id !== roomGame.id) {
    body = <div className="flex h-full items-center justify-center text-muted">Loading game…</div>;
  } else if (game.state.finished) {
    body = <Results rows={game.state.leaderboard ?? []} deadlineAt={game.state.deadlineAt} />;
  } else if (Component) {
    body = <Component state={game.state} />;
  } else {
    body = <div className="flex h-full items-center justify-center text-muted">This game isn't available yet.</div>;
  }

  return (
    <div className={cn('flex h-full', side ? 'flex-col md:flex-row' : 'flex-col')}>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 md:p-5">{body}</div>
      <div className={cn('shrink-0 border-line bg-panel/40',
        side ? 'h-28 border-t md:h-auto md:w-56 md:border-t-0 md:border-l' : 'h-28 md:h-36 border-t')}>
        <VideoStrip participants={participants} colors={colors}
          direction={side ? 'side' : 'horizontal'} />
      </div>
    </div>
  );
}
