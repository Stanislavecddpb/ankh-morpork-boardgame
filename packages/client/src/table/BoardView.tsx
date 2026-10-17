import { useEffect, useRef, useState } from 'react';
import { AREA_IDS, type AMState, type AreaId, type Color } from '@am/engine';
import geometry from './areas.json';
import { BOARD, DEMON, TROLL, TROUBLE, tokenImg } from './assets';
import { readPiece, type DragPiece } from './Supply';

interface Geometry { width: number; height: number; areas: Record<string, { points: number[][]; anchor: number[] }> }
const GEO = geometry as unknown as Geometry;
const W = GEO.width;
const H = GEO.height;
const S = W / 18; // размер жетона
const MIN_W = W / 5; // максимальное приближение

interface View { x: number; y: number; w: number }

/** Поле: колесо — зум к курсору, перетаскивание — панорама, двойной клик — сброс. */
export function BoardView({ G, highlight, selected, onArea, onDropPiece }: {
  G: AMState; highlight: AreaId[]; selected: AreaId | null;
  onArea: (id: AreaId) => void; onDropPiece: (id: AreaId, piece: DragPiece) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, w: W });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pan = useRef<{ px: number; py: number; view: View; moved: boolean } | null>(null);
  const [dropTarget, setDropTarget] = useState<AreaId | null>(null);
  const colorOf = (pid: string): Color => G.players[pid]?.color ?? 'red';
  const h = (view.w * H) / W;

  /** Пикселей экрана на единицу поля при текущем виде. */
  function pxPerUnit(v: View): number {
    const r = svgRef.current!.getBoundingClientRect();
    return Math.min(r.width / v.w, r.height / ((v.w * H) / W));
  }

  function clamp(v: View): View {
    const w = Math.min(W, Math.max(MIN_W, v.w));
    const hh = (w * H) / W;
    return { w, x: Math.min(W - w, Math.max(0, v.x)), y: Math.min(H - hh, Math.max(0, v.y)) };
  }

  // Колесо вешаем вручную: React делает wheel пассивным, а нам нужен preventDefault.
  useEffect(() => {
    const svg = svgRef.current!;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const v = viewRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      const k = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      const w = Math.min(W, Math.max(MIN_W, v.w * k));
      const f = w / v.w;
      setView(clamp({ w, x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f }));
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    pan.current = { px: e.clientX, py: e.clientY, view, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (!p.moved && Math.hypot(dx, dy) < 5) return;
    p.moved = true;
    const s = pxPerUnit(p.view);
    setView(clamp({ ...p.view, x: p.view.x - dx / s, y: p.view.y - dy / s }));
  }
  function onPointerUp() {
    // Сбрасываем после click-события, чтобы перетаскивание не считалось кликом по району.
    setTimeout(() => { pan.current = null; }, 0);
  }
  const wasPanned = () => !!pan.current?.moved;

  return (
    <div className="board-wrap">
      <svg ref={svgRef} className={`board ${view.w < W ? 'zoomed' : ''}`} viewBox={`${view.x} ${view.y} ${view.w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        onDoubleClick={() => setView({ x: 0, y: 0, w: W })}>
        <image href={BOARD} width={W} height={H} />
        {AREA_IDS.map((id) => {
          const g = GEO.areas[id];
          if (!g) return null;
          const cls = ['area', highlight.includes(id) ? 'hl' : '', selected === id ? 'sel' : '', dropTarget === id ? 'drop' : ''].join(' ');
          return (
            <polygon key={id} className={cls} points={g.points.map((p) => p.join(',')).join(' ')}
              onClick={() => !wasPanned() && highlight.includes(id) && onArea(id)}
              onDragOver={(e) => { e.preventDefault(); if (dropTarget !== id) setDropTarget(id); }}
              onDragLeave={() => setDropTarget((t) => (t === id ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const piece = readPiece(e.dataTransfer);
                if (piece) onDropPiece(id, piece);
              }} />
          );
        })}
        {AREA_IDS.map((id) => <AreaPieces key={id} G={G} id={id} colorOf={colorOf} />)}
      </svg>
      {view.w < W && <button className="zoom-reset" onClick={() => setView({ x: 0, y: 0, w: W })}>⤢ Всё поле</button>}
    </div>
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
