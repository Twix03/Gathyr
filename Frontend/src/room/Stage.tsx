import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MediaParticipant } from '../media/useMediaParticipants';
import { VideoTile, tilesFor, type TileData } from './VideoTile';
import { cn } from '../ui/cn';

const GAP = 10;
const ASPECT = 16 / 9;

/** Pick the column count that makes tiles as large as possible inside the container. */
function bestGrid(count: number, width: number, height: number) {
  let best = { cols: 1, w: 0, h: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    let w = (width - GAP * (cols - 1)) / cols;
    let h = w / ASPECT;
    if (h * rows + GAP * (rows - 1) > height) {
      h = (height - GAP * (rows - 1)) / rows;
      w = h * ASPECT;
    }
    if (w > best.w) best = { cols, w, h };
  }
  return best;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Stage({ participants, colors, layout, pinned, onPin }: {
  participants: MediaParticipant[];
  colors: Map<string, number>;
  layout: 'grid' | 'spotlight';
  pinned: string | null;
  onPin: (key: string | null) => void;
}) {
  const tiles = useMemo(() => tilesFor(participants, colors), [participants, colors]);
  const screenShare = tiles.find((t) => t.kind === 'screen');
  const featured = tiles.find((t) => t.key === pinned) ?? (layout === 'spotlight' || screenShare ? spotlightPick(tiles) : null);

  const togglePin = (key: string) => onPin(pinned === key ? null : key);

  if (featured && tiles.length > 1) {
    const rest = tiles.filter((t) => t.key !== featured.key);
    return (
      <div className="flex h-full w-full flex-col gap-2.5 p-2.5 md:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <VideoTile tile={featured} className="h-full w-full" pinned={pinned === featured.key}
            onPin={() => togglePin(featured.key)} />
        </div>
        <div className="flex shrink-0 gap-2.5 overflow-auto no-scrollbar md:w-56 md:flex-col h-28 md:h-auto">
          {rest.map((t) => (
            <VideoTile key={t.key} tile={t} compact className="aspect-video h-full md:h-auto md:w-full shrink-0"
              onPin={() => togglePin(t.key)} />
          ))}
        </div>
      </div>
    );
  }
  return <Grid tiles={tiles} pinned={pinned} onPin={togglePin} />;
}

function spotlightPick(tiles: TileData[]): TileData | undefined {
  return tiles.find((t) => t.kind === 'screen')
    ?? tiles.find((t) => t.participant.isSpeaking && !t.participant.isLocal)
    ?? tiles.find((t) => !t.participant.isLocal)
    ?? tiles[0];
}

function Grid({ tiles, pinned, onPin }: { tiles: TileData[]; pinned: string | null; onPin: (key: string) => void }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const { cols, w, h } = bestGrid(tiles.length || 1, Math.max(0, size.width - 20), Math.max(0, size.height - 20));
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center p-2.5">
      <div className="flex flex-wrap justify-center" style={{ gap: GAP, maxWidth: cols * w + (cols - 1) * GAP }}>
        {tiles.map((t) => (
          <div key={t.key} style={{ width: w, height: h }} className={cn(w === 0 && 'invisible')}>
            <VideoTile tile={t} className="h-full w-full" compact={w < 260}
              pinned={pinned === t.key} onPin={() => onPin(t.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Strip of tiles shown beside a game. "side" = right column on desktop, bottom row on phones. */
export function VideoStrip({ participants, colors, direction }: {
  participants: MediaParticipant[];
  colors: Map<string, number>;
  direction: 'side' | 'horizontal';
}) {
  const tiles = useMemo(() => tilesFor(participants, colors), [participants, colors]);
  return (
    <div className={cn('flex h-full gap-2 overflow-auto no-scrollbar p-2',
      direction === 'side' ? 'flex-row md:flex-col' : 'flex-row')}>
      {tiles.map((t) => (
        <VideoTile key={t.key} tile={t} compact
          className={cn('aspect-video shrink-0 h-full', direction === 'side' && 'md:h-auto md:w-full')} />
      ))}
    </div>
  );
}
