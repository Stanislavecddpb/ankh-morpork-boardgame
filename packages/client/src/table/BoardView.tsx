import { useEffect, useRef, useState } from 'react';
import { AREA_IDS, type AMState, type AreaId, type Color } from '@am/engine';
import geometry from './areas.json';
import { BOARD, DEMON, TROLL, TROUBLE, tokenImg } from './assets';
import { readPiece, type DragPiece } from './Supply';

interface Geometry {
  width: number; height: number;
  /** avoid — прямоугольники [x0, y0, x1, y1] с названием, номером и ценой района: фишки их не закрывают. */
  areas: Record<string, { points: number[][]; anchor: number[]; avoid?: number[][] }>;
}
const GEO = geometry as unknown as Geometry;
const W = GEO.width;
const H = GEO.height;
const T = W / 34; // размер жетона на поле
const MIN_W = W / 5; // максимальное приближение
const PAD = 12; // зазор между фишкой и надписью района

interface View { x: number; y: number; w: number }

const CHANGED_MS = 4000;

/** Районы, где только что что-то изменилось (фишки, здание, беспорядок), — подсвечиваются на несколько секунд. */
function useChangedAreas(G: AMState): AreaId[] {
  const prev = useRef<string[] | null>(null);
  const [changed, setChanged] = useState<AreaId[]>([]);
  const key = AREA_IDS.map((id) => JSON.stringify(G.areas[id]));
  const sig = key.join('|');
  useEffect(() => {
    const before = prev.current;
    prev.current = key;
    if (!before) return;
    const ids = AREA_IDS.filter((_, i) => before[i] !== key[i]);
    if (ids.length === 0) return;
    setChanged(ids);
    const t = setTimeout(() => setChanged([]), CHANGED_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return changed;
}

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
  const changed = useChangedAreas(G);
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
          const cls = ['area', changed.includes(id) ? 'changed' : '', highlight.includes(id) ? 'hl' : '', selected === id ? 'sel' : '', dropTarget === id ? 'drop' : ''].join(' ');
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

/** Точка внутри многоугольника (луч вправо). */
function inside(px: number, py: number, pts: number[][]): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Места под фишки в районе: узлы сетки, у которых жетон целиком внутри контура
 * и не закрывает надписи района, отсортированные по удалённости от якоря.
 */
function slotsFor(id: AreaId): number[][] {
  const g = GEO.areas[id];
  const pts = g.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const r = T * 0.5;
  const fine = T / 4;
  const cand: number[][] = [];
  for (let x = Math.min(...xs) + r; x <= Math.max(...xs) - r; x += fine) {
    for (let y = Math.min(...ys) + r; y <= Math.max(...ys) - r; y += fine) {
      const corners = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]];
      const clear = (g.avoid ?? []).every(([x0, y0, x1, y1]) =>
        x + r < x0 - PAD || x - r > x1 + PAD || y + r < y0 - PAD || y - r > y1 + PAD);
      if (clear && corners.every(([cx, cy]) => inside(cx, cy, pts))) cand.push([x, y]);
    }
  }
  // Жадно: ближайшие к якорю точки, не ближе жетона друг к другу.
  const [ax, ay] = g.anchor;
  cand.sort((a, b) => Math.hypot(a[0] - ax, a[1] - ay) - Math.hypot(b[0] - ax, b[1] - ay));
  const out: number[][] = [];
  for (const c of cand) {
    if (out.every((o) => Math.max(Math.abs(o[0] - c[0]), Math.abs(o[1] - c[1])) >= T * 0.98)) out.push(c);
  }
  return out;
}

const SLOTS: Record<number, number[][]> = Object.fromEntries(
  AREA_IDS.filter((id) => GEO.areas[id]).map((id) => [id, slotsFor(id)]),
);

function AreaPieces({ G, id, colorOf }: { G: AMState; id: AreaId; colorOf: (pid: string) => Color }) {
  const slots = SLOTS[id];
  if (!slots?.length) return null;
  const a = G.areas[id];
  const items: { href: string; key: string }[] = [];
  if (a.building) items.push({ href: tokenImg('building', colorOf(a.building)), key: 'b' });
  if (a.trouble) items.push({ href: TROUBLE, key: 'x' });
  for (const [pid, n] of Object.entries(a.minions)) {
    for (let i = 0; i < n; i++) items.push({ href: tokenImg('minion', colorOf(pid)), key: `m${pid}-${i}` });
  }
  for (let i = 0; i < a.demons; i++) items.push({ href: DEMON, key: `d${i}` });
  for (let i = 0; i < a.trolls; i++) items.push({ href: TROLL, key: `t${i}` });
  return (
    <g pointerEvents="none">
      {items.map((it, i) => {
        // Если мест не хватило, следующий круг кладём со сдвигом поверх.
        const [x, y] = slots[i % slots.length];
        const shift = Math.floor(i / slots.length) * T * 0.3;
        return <image key={it.key} href={it.href} x={x - T / 2 + shift} y={y - T / 2 - shift} width={T} height={T} className="piece" />;
      })}
    </g>
  );
}
