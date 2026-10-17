import { useState } from 'react';
import initial from '../table/areas.json';
import { AREAS } from '@am/engine';
import { BOARD } from '../table/assets';

type Pt = [number, number];
interface AreaGeom { points: Pt[]; anchor: Pt }
interface Geometry { width: number; height: number; areas: Record<string, AreaGeom> }

/**
 * Разметка районов: клик — точка контура текущего района, Shift+клик — якорь фишек.
 * «Очистить» стирает контур района. Готовый JSON копируется в packages/client/src/table/areas.json.
 */
export function AreaEditor() {
  const [geo, setGeo] = useState<Geometry>(initial as unknown as Geometry);
  const [current, setCurrent] = useState(1);
  const [copied, setCopied] = useState(false);

  function click(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const xy: Pt = [Math.round(p.x), Math.round(p.y)];
    setGeo((g) => {
      const a = g.areas[current] ?? { points: [], anchor: xy };
      const next = e.shiftKey ? { ...a, anchor: xy } : { ...a, points: [...a.points, xy] };
      return { ...g, areas: { ...g.areas, [current]: next } };
    });
  }

  function editPoints(fn: (pts: Pt[]) => Pt[]) {
    setGeo((g) => {
      const a = g.areas[current];
      if (!a) return g;
      return { ...g, areas: { ...g.areas, [current]: { ...a, points: fn(a.points) } } };
    });
  }

  const json = JSON.stringify(geo);

  return (
    <div className="editor">
      <div className="editor-bar">
        {AREAS.map((a) => (
          <button key={a.id} className={a.id === current ? 'on' : ''} onClick={() => setCurrent(a.id)}>
            {a.id}. {a.name} {geo.areas[a.id]?.points.length ? '✓' : ''}
          </button>
        ))}
        <button onClick={() => editPoints((pts) => pts.slice(0, -1))}>↶ точка</button>
        <button onClick={() => editPoints(() => [])}>Очистить</button>
        <button onClick={() => navigator.clipboard.writeText(json).then(() => setCopied(true))}>
          {copied ? 'Скопировано' : 'Скопировать JSON'}
        </button>
      </div>
      {geo.width > 0 && (
        <svg className="editor-board" viewBox={`0 0 ${geo.width} ${geo.height}`} onClick={click}>
          <image href={BOARD} width={geo.width} height={geo.height} />
          {Object.entries(geo.areas).map(([id, a]) => (
            <g key={id}>
              <polygon points={a.points.map((p) => p.join(',')).join(' ')}
                fill={Number(id) === current ? '#ff000040' : '#0000ff25'} stroke="#000" strokeWidth={3} />
              <circle cx={a.anchor[0]} cy={a.anchor[1]} r={12} fill="#ff0" stroke="#000" strokeWidth={3} />
            </g>
          ))}
        </svg>
      )}
      <img src={BOARD} alt="" style={{ display: 'none' }}
        onLoad={(e) => {
          const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
          setGeo((g) => (g.width ? g : { ...g, width, height }));
        }} />
    </div>
  );
}
