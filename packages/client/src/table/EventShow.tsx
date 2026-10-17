import { useEffect, useRef, useState } from 'react';
import { AREA_IDS, EVENT_BY_ID, areaDef, type AMState, type AreaId } from '@am/engine';
import { eventImg } from './assets';
import { D12 } from './Dice';

/** Оформление событий: значок и цвет вспышки. */
const THEME: Record<string, { icon: string; color: string }> = {
  'the-dragon': { icon: '🐉', color: '#e0301e' },
  flood: { icon: '🌊', color: '#2a7fd4' },
  fire: { icon: '🔥', color: '#ff6a00' },
  fog: { icon: '🌫️', color: '#8a93a6' },
  riots: { icon: '✊', color: '#b3261e' },
  explosion: { icon: '💥', color: '#ff9800' },
  'mysterious-murders': { icon: '🗡️', color: '#6d1b1b' },
  'demons-from-dungeon-dimensions': { icon: '😈', color: '#7b2fa8' },
  subsidence: { icon: '🏚️', color: '#8a6a45' },
  'bloody-stupid-johnson': { icon: '🔨', color: '#c48a00' },
  trolls: { icon: '🪨', color: '#5f8f3a' },
  earthquake: { icon: '🌋', color: '#a8501e' },
};

const INTRO_MS = 2600;
const SPIN_MS = 1000;
const LAND_MS = 1300;
const LINE_MS = 450;
const AUTO_CLOSE_MS = 9000;

type Phase = 'intro' | 'roll' | 'result';

const AREA_NAMES = new Set(AREA_IDS.map((id) => areaDef(id).name));

/** Строки лога про это событие после его вытягивания (живые: пополняются, пока событие разыгрывается). */
function eventLines(G: AMState, id: string): string[] {
  const name = EVENT_BY_ID[id]?.name ?? id;
  const start = G.log.lastIndexOf(`Случайное событие: «${name}»`);
  if (start < 0) return [];
  const prefix = `«${name}»: `;
  return G.log.slice(start + 1).filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length))
    // Числа на кубике и так показаны — оставляем только смысл («пожар не начался», «затоплено: …»).
    .map((l) => l.replace(/^на кубике [\d, ]+(\([^)]*\))?( — )?/, ''))
    // Строка из одних названий районов — повтор выпавших бросков.
    .filter((l) => l && !l.split(', ').every((part) => AREA_NAMES.has(part)))
    .map((l) => l.charAt(0).toUpperCase() + l.slice(1));
}

/**
 * Случайное событие крупно у всех игроков: вспышка и карта → броски кубика с подсветкой районов на поле →
 * что произошло. Возвращает выпавший сейчас район для подсветки на поле.
 */
export function EventShow({ G, onArea }: { G: AMState; onArea: (id: AreaId | null) => void }) {
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const [show, setShow] = useState<{ id: string; rolls: number[] } | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [rollIdx, setRollIdx] = useState(0);
  const [face, setFace] = useState(1);
  const [landed, setLanded] = useState(false);
  const [lines, setLines] = useState(0);
  const [hover, setHover] = useState(false);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const close = () => { clear(); setShow(null); onArea(null); };

  const seq = G.eventShow?.seq ?? 0;
  useEffect(() => {
    if (seen.current === null) { seen.current = seq; return; } // при входе в партию старое не показываем
    if (seq === seen.current || !G.lastEvent) return;
    seen.current = seq;
    clear();
    const rolls = G.dice.seq === G.eventShow.diceSeq ? [...G.dice.values] : [];
    setShow({ id: G.lastEvent, rolls });
    setPhase('intro');
    setLines(0);
    setRollIdx(0);
    let t = INTRO_MS;
    rolls.forEach((v, i) => {
      at(t, () => { setPhase('roll'); setRollIdx(i); setLanded(false); onArea(null); });
      for (let k = 0, dt = 45; dt < SPIN_MS; k++, dt *= 1.18) at(t + dt, () => setFace(((v + k * 5) % 12) + 1));
      at(t + SPIN_MS, () => { setFace(v); setLanded(true); onArea(v); });
      t += SPIN_MS + LAND_MS;
    });
    at(t, () => { setPhase('result'); onArea(null); });
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Итог: строки появляются по одной; окно закрывается само, если на него не навели мышь.
  const all = show ? eventLines(G, show.id) : [];
  useEffect(() => {
    if (phase !== 'result' || !show) return;
    if (lines < all.length) {
      const t = window.setTimeout(() => setLines((n) => n + 1), LINE_MS);
      return () => window.clearTimeout(t);
    }
    if (hover) return;
    const t = window.setTimeout(close, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [phase, lines, all.length, hover, show]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => clear, []);
  if (!show) return null;
  const ev = EVENT_BY_ID[show.id];
  const theme = THEME[show.id] ?? { icon: '⚡', color: '#c48a00' };
  const rolled = show.rolls.slice(0, phase === 'result' ? show.rolls.length : rollIdx + (landed ? 1 : 0));

  return (
    <div className={`event-show phase-${phase}`} style={{ ['--ev' as string]: theme.color }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="event-show-backdrop" onClick={close} />
      <div className="event-show-box">
        <div className="event-show-rays" />
        <div className="event-show-card">
          <img src={eventImg(show.id)} alt={ev?.name} />
        </div>
        <div className="event-show-body">
          <div className="event-show-kicker">{theme.icon} Случайное событие</div>
          <h2>{ev?.name}</h2>
          {phase === 'roll' && (
            <div className="event-show-roll">
              <D12 face={face} spinning={!landed} />
              <div className="event-show-area">
                {landed ? <>{face}: <b>{areaDef(face).name}</b></> : 'Бросок…'}
                {show.rolls.length > 1 && <span> · {rollIdx + 1} из {show.rolls.length}</span>}
              </div>
            </div>
          )}
          {rolled.length > 0 && (
            <div className="event-show-areas">
              {rolled.map((v, i) => <span key={i}>{theme.icon} {v} · {areaDef(v).name}</span>)}
            </div>
          )}
          {phase === 'result' && (
            <ul className="event-show-lines">
              {all.slice(0, lines).map((l, i) => <li key={i}>{l}</li>)}
              {all.length === 0 && <li>Ничего не произошло.</li>}
            </ul>
          )}
          <button className="btn event-show-ok" onClick={close}>{phase === 'result' ? 'Понятно' : 'Пропустить'}</button>
        </div>
      </div>
    </div>
  );
}
