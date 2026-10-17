import { AREA_IDS, type AMState, type AreaId, type Color } from '@am/engine';
import geometry from './areas.json';
import { BOARD, DEMON, TROLL, TROUBLE, tokenImg } from './assets';

interface Geometry { width: number; height: number; areas: Record<string, { points: number[][]; anchor: number[] }> }
const GEO = geometry as unknown as Geometry;
const S = GEO.width / 18; // размер жетона

export function BoardView({ G, highlight, selected, onArea }: {
  G: AMState; highlight: AreaId[]; selected: AreaId | null; onArea: (id: AreaId) => void;
}) {
  const colorOf = (pid: string): Color => G.players[pid]?.color ?? 'red';
  return (
    <svg className="board" viewBox={`0 0 ${GEO.width} ${GEO.height}`} preserveAspectRatio="xMidYMid meet">
      <image href={BOARD} width={GEO.width} height={GEO.height} />
      {AREA_IDS.map((id) => {
        const g = GEO.areas[id];
        if (!g) return null;
        const cls = ['area', highlight.includes(id) ? 'hl' : '', selected === id ? 'sel' : ''].join(' ');
        return <polygon key={id} className={cls} points={g.points.map((p) => p.join(',')).join(' ')}
          onClick={() => highlight.includes(id) && onArea(id)} />;
      })}
      {AREA_IDS.map((id) => <AreaPieces key={id} G={G} id={id} colorOf={colorOf} />)}
    </svg>
  );
}

function AreaPieces({ G, id, colorOf }: { G: AMState; id: AreaId; colorOf: (pid: string) => Color }) {
  const g = GEO.areas[id];
  if (!g) return null;
  const a = G.areas[id];
  const items: { href: string; key: string; count?: number }[] = [];
  if (a.building) items.push({ href: tokenImg('building', colorOf(a.building)), key: 'b' });
  for (const [pid, n] of Object.entries(a.minions)) if (n > 0) items.push({ href: tokenImg('minion', colorOf(pid)), key: `m${pid}`, count: n });
  if (a.demons) items.push({ href: DEMON, key: 'd', count: a.demons });
  if (a.trolls) items.push({ href: TROLL, key: 't', count: a.trolls });
  if (a.trouble) items.push({ href: TROUBLE, key: 'x' });
  const [cx, cy] = g.anchor;
  const cols = Math.min(3, items.length);
  return (
    <g pointerEvents="none">
      {items.map((it, i) => {
        const x = cx + ((i % 3) - (cols - 1) / 2) * S * 1.05 - S / 2;
        const y = cy + Math.floor(i / 3) * S * 1.05 - S / 2;
        return (
          <g key={it.key}>
            <image href={it.href} x={x} y={y} width={S} height={S} className="piece" />
            {it.count && it.count > 1 && (
              <text className="piece-count" x={x + S} y={y + S} fontSize={S * 0.5} textAnchor="end">×{it.count}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}
