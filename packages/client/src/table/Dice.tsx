import { useEffect, useRef, useState } from 'react';
import { areaDef, type AMState, type AreaId } from '@am/engine';

const SPIN_MS = 1100;
const SHOW_MS = 1300;

export interface DiceShow {
  /** Число на грани сейчас (во время вращения мелькает). */
  face: number;
  spinning: boolean;
  /** Выпавший район (после остановки) — для подсветки на поле. */
  area: AreaId | null;
  index: number;
  total: number;
}

/**
 * Анимация бросков: когда G.dice.seq меняется, по очереди проигрываем каждое значение
 * (кручение с мельканием чисел, затем остановка и подсветка района). Старые броски при входе не показываем.
 */
export function useDiceShow(dice: AMState['dice'] | undefined, mutedSeq = -1): [DiceShow | null, () => void] {
  const [show, setShow] = useState<DiceShow | null>(null);
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  useEffect(() => {
    if (!dice) return;
    if (seen.current === null) { seen.current = dice.seq; return; }
    if (dice.seq === seen.current || dice.values.length === 0) return;
    seen.current = dice.seq;
    // Броски случайного события показывает окно события.
    if (dice.seq === mutedSeq) return;
    clear();
    const values = [...dice.values];
    let t = 0;
    values.forEach((v, i) => {
      // Вращение: числа мелькают всё медленнее.
      for (let k = 0, dt = 50; t + dt < (SPIN_MS + SHOW_MS) * i + SPIN_MS; k++, dt *= 1.12) {
        t += dt;
        const face = ((v + k * 5) % 12) + 1;
        timers.current.push(window.setTimeout(() => setShow({ face, spinning: true, area: null, index: i, total: values.length }), t));
      }
      t = (SPIN_MS + SHOW_MS) * i + SPIN_MS;
      timers.current.push(window.setTimeout(() => setShow({ face: v, spinning: false, area: v, index: i, total: values.length }), t));
      t = (SPIN_MS + SHOW_MS) * (i + 1);
    });
    timers.current.push(window.setTimeout(() => setShow(null), t));
  }, [dice?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => clear, []);
  return [show, () => { clear(); setShow(null); }];
}

/** Двенадцатигранник «в лоб»: пятиугольная грань в центре и пять соседних по кругу. */
export function D12({ face, spinning }: { face: number; spinning: boolean }) {
  const pt = (r: number, i: number, off = -90) => {
    const a = ((off + i * 72) * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  };
  const inner = [0, 1, 2, 3, 4].map((i) => pt(22, i));
  const outer = Array.from({ length: 10 }, (_, i) => {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return [50 + 46 * Math.cos(a), 50 + 46 * Math.sin(a)];
  });
  const path = (ps: number[][]) => ps.map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox="0 0 100 100" className={`d12 ${spinning ? 'spinning' : 'landed'}`}>
      <polygon points={path(outer)} className="d12-body" />
      {inner.map((p, i) => <line key={i} x1={p[0]} y1={p[1]} x2={outer[i * 2][0]} y2={outer[i * 2][1]} className="d12-edge" />)}
      <polygon points={path(inner)} className="d12-face" />
      <text x="50" y="51" className="d12-num" dominantBaseline="middle" textAnchor="middle">{face}</text>
    </svg>
  );
}

export function DiceOverlay({ show, onSkip }: { show: DiceShow | null; onSkip: () => void }) {
  if (!show) return null;
  return (
    <div className="dice-overlay" onClick={onSkip} title="Нажмите, чтобы пропустить">
      <D12 face={show.face} spinning={show.spinning} />
      <div className="dice-caption">
        {show.spinning ? 'Бросок…' : `${show.face}: ${areaDef(show.face).name}`}
        {show.total > 1 && <span> ({show.index + 1} из {show.total})</span>}
      </div>
    </div>
  );
}
