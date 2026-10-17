import { useEffect, useState } from 'react';
import { CARD_BY_ID, HIDDEN_CARD, isInterrupt, type AMState } from '@am/engine';
import { cardImg } from './assets';

/** Рука — выдвижная панель поверх низа поля: закрыта, пока не нужна (и чтобы не подсмотрели). */
export function Hand({ G, me, open, setOpen, canPlay, onPlay, onInterrupt, select }: {
  G: AMState; me: string | null; open: boolean; setOpen: (v: boolean) => void;
  canPlay: boolean; onPlay: (cardId: string) => void;
  /** Сыграть карту-прерывание вне очереди. */
  onInterrupt?: (cardId: string) => void;
  /** Режим выбора карт для вопроса свитка. */
  select?: { min: number; max: number; onDone: (cards: string[]) => void };
}) {
  const hand = (me ? G.players[me]?.hand ?? [] : []).filter((c) => c !== HIDDEN_CARD);
  // Наведённая карта показывается крупно рядом с рукой, чтобы читался текст.
  const [preview, setPreview] = useState<{ id: string; left: number; bottom: number; height: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [select?.min, select?.max, hand.length]);

  function toggle(id: string) {
    if (!select) return;
    setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < select.max ? [...x, id] : x));
  }

  return (
    <div className={`hand-drawer ${open ? 'open' : ''}`}>
      {!select && (
        <button className="hand-toggle btn" onClick={() => setOpen(!open)}>
          🂠 {open ? 'Скрыть руку' : `Рука (${hand.length})`}{!open && canPlay ? ' — ваш ход' : ''}
        </button>
      )}
      {open && (
        <div className="hand">
          {hand.map((id, i) => (
            <button key={`${id}-${i}`} className={`hand-card ${picked.includes(id) ? 'picked' : ''}`}
              disabled={!select && !canPlay}
              onClick={() => {
                if (select) toggle(id);
                else { setPreview(null); onPlay(id); }
              }}
              onMouseEnter={(e) => {
                // Над панелью руки, по центру наведённой карты, не выходя за края экрана.
                const r = e.currentTarget.getBoundingClientRect();
                const panelTop = e.currentTarget.parentElement!.getBoundingClientRect().top;
                const height = Math.min(window.innerHeight * 0.62, panelTop - 24);
                const width = height * 0.632;
                const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
                setPreview({ id, left, bottom: window.innerHeight - panelTop + 12, height });
              }}
              onMouseLeave={() => setPreview(null)}
              title={select ? 'Выбрать' : canPlay ? `Сыграть «${CARD_BY_ID[id]?.name}»` : CARD_BY_ID[id]?.name}>
              <img src={cardImg(id)} alt={CARD_BY_ID[id]?.name ?? id} />
            </button>
          ))}
          {hand.length === 0 && <div className="hand-empty">Рука пуста</div>}
          {!select && onInterrupt && hand.some(isInterrupt) && (
            <div className="hand-interrupts">
              {hand.filter(isInterrupt).map((id) => (
                <button key={id} className="btn small" onClick={() => onInterrupt(id)}>✋ {CARD_BY_ID[id]?.name}</button>
              ))}
            </div>
          )}
          {select && (
            <div className="hand-select">
              Выбрано {picked.length} из {select.min === select.max ? select.max : `${select.min}–${select.max}`}
              <button className="btn" disabled={picked.length < select.min} onClick={() => select.onDone(picked)}>Готово</button>
            </div>
          )}
        </div>
      )}
      {open && preview && <img className="card-preview" src={cardImg(preview.id)} alt="" style={{ left: preview.left, bottom: preview.bottom, height: preview.height }} />}
    </div>
  );
}
