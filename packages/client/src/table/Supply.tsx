import { useState } from 'react';
import { AREA_IDS, MAX_DEMONS, MAX_TROLLS, type AMState, type Color } from '@am/engine';
import { COLOR_HEX, DEMON, TROLL, TROUBLE, tokenImg } from './assets';

/** Фишка, которую тащат из запаса на район. */
export type DragPiece =
  | { kind: 'minion'; owner: string }
  | { kind: 'building'; owner: string }
  | { kind: 'demon' }
  | { kind: 'troll' }
  | { kind: 'trouble' };

const MIME = 'application/x-am-piece';

export function readPiece(dt: DataTransfer): DragPiece | null {
  try {
    return JSON.parse(dt.getData(MIME)) as DragPiece;
  } catch {
    return null;
  }
}

function Token({ src, piece, disabled, title }: { src: string; piece: DragPiece; disabled: boolean; title: string }) {
  return (
    <img className={`supply-token ${disabled ? 'off' : ''}`} src={src} alt={title} title={title}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, JSON.stringify(piece));
        e.dataTransfer.effectAllowed = 'move';
      }} />
  );
}

/**
 * Запас фишек слева от поля. Свои слуги и здания можно тащить на район, когда карта
 * разрешает (подсвеченные районы). В ручном режиме — фишки любого игрока и нейтральные.
 */
export function Supply({ G, me, manual, canDrag, nameOf }: {
  G: AMState; me: string | null; manual: boolean; canDrag: boolean; nameOf: (pid: string) => string;
}) {
  const pids = Object.keys(G.players);
  const [chosen, setChosen] = useState<string | null>(null);
  const owner = (manual ? chosen : null) ?? me ?? pids[0];
  const p = G.players[owner];
  if (!p) return null;
  const color: Color = p.color ?? 'red';
  const onBoard = (key: 'demons' | 'trolls') => AREA_IDS.reduce((s, id) => s + G.areas[id][key], 0);
  const off = !canDrag && !manual;

  return (
    <aside className="supply">
      {manual ? (
        <select className="supply-owner" value={owner} onChange={(e) => setChosen(e.target.value)}
          style={{ borderColor: COLOR_HEX[color] }}>
          {pids.map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
        </select>
      ) : (
        <div className="supply-title">Запас</div>
      )}
      <div className="supply-group">
        {Array.from({ length: p.minionSupply }, (_, i) => (
          <Token key={`m${i}`} src={tokenImg('minion', color)} piece={{ kind: 'minion', owner }} disabled={off} title="Слуга" />
        ))}
      </div>
      <div className="supply-group">
        {Array.from({ length: p.buildingSupply }, (_, i) => (
          <Token key={`b${i}`} src={tokenImg('building', color)} piece={{ kind: 'building', owner }} disabled={off} title="Здание" />
        ))}
      </div>
      {manual && (
        <div className="supply-group neutral">
          {onBoard('demons') < MAX_DEMONS && <Token src={DEMON} piece={{ kind: 'demon' }} disabled={false} title="Демон" />}
          {onBoard('trolls') < MAX_TROLLS && <Token src={TROLL} piece={{ kind: 'troll' }} disabled={false} title="Тролль" />}
          <Token src={TROUBLE} piece={{ kind: 'trouble' }} disabled={false} title="Беспорядок" />
        </div>
      )}
    </aside>
  );
}
