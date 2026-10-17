import { createContext, useEffect, useState, type ReactNode } from 'react';
import { CARD_BY_ID, PERSONALITY_BY_ID, type AMState, type PersonalityId } from '@am/engine';
import { cardImg, effectImg, personalityImg } from './assets';

/** В хотсите — переключить «сиденье» клиента на игрока. */
export const SeatContext = createContext<((pid: string) => void) | null>(null);

const imgOf = (id: string) => (id in PERSONALITY_BY_ID ? personalityImg(id as PersonalityId) : cardImg(id));
const nameOfCard = (id: string) => PERSONALITY_BY_ID[id as PersonalityId]?.name ?? CARD_BY_ID[id]?.name ?? id;

/** Окно вопроса, которое можно свернуть: посмотреть руку и поле, потом вернуться к выбору. */
function Collapsible({ id, title, className, children }: { id: string; title: string; className: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [id]);
  if (hidden) {
    return <button className="btn prompt-restore" onClick={() => setHidden(false)}>↩ Вернуться к выбору: {title}</button>;
  }
  return (
    <div className="popup">
      <div className={`popup-box ${className}`}>
        <button className="btn ghost small popup-hide" title="Скрыть, чтобы посмотреть свои карты и поле" onClick={() => setHidden(true)}>Свернуть ▾</button>
        {children}
      </div>
    </div>
  );
}

/** Вопрос сопернику (кнопки или выбор карт из его руки) — у того, кто отвечает. */
export function RespondModal({ G, ctx, me, moves }: { G: AMState; ctx: any; me: string | null; moves: any }) {
  const p = G.prompt;
  const [picked, setPicked] = useState<string[]>([]);
  if (!p || !me || p.actor !== me || p.actor === ctx.currentPlayer || (p.kind !== 'choice' && p.kind !== 'hand')) return null;
  const hand = G.players[me].hand;
  const toggle = (c: string) =>
    setPicked((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < (p.max ?? 99) ? [...x, c] : x));
  return (
    <Collapsible id={`${p.cardId}:${p.step}:${p.actor}`} title={p.text} className="respond-box">
        <img className="respond-card" src={effectImg(p.cardId)} alt="" />
        <div className="respond-body">
          <h3>{p.text}</h3>
          {p.kind === 'choice' && p.options.map((o) => (
            <button key={o} className="btn" onClick={() => moves.answer(o)}>{p.labels?.[o] ?? o}</button>
          ))}
          {p.kind === 'hand' && (
            <>
              <div className="reveal">
                {hand.map((c) => (
                  <button key={c} className={`hand-card ${picked.includes(c) ? 'picked' : ''}`} onClick={() => toggle(c)}>
                    <img src={cardImg(c)} alt={nameOfCard(c)} />
                  </button>
                ))}
              </div>
              <button className="btn" disabled={picked.length < (p.min ?? 0)} onClick={() => { moves.answer(picked); setPicked([]); }}>
                Отдать ({picked.length})
              </button>
            </>
          )}
        </div>
    </Collapsible>
  );
}

/** Предложение сыграть прерывание — только пострадавшему. */
export function OfferModal({ G, me, moves }: { G: AMState; me: string | null; moves: any }) {
  const o = G.offers[0];
  if (!o || o.player !== me) return null;
  const cards = o.relocate ? [o.relocate.card] : [...new Set(o.options.filter((x) => x !== 'none').map((x) => x.split('@')[0]))];
  const text = o.relocate
    ? `«${nameOfCard(o.relocate.card)}»: в какой район поставить слугу?`
    : o.source === 'target'
      ? 'Вас выбрали целью текста карты. Сыграть прерывание?'
      : o.source === 'mass'
        ? `${G.play ? `«${nameOfCard(G.play.cardId)}»` : 'Текст карты'} касается всех игроков. Сыграть прерывание?`
      : `Ваш${o.losses.length > 1 ? 'их слуг' : 'его слугу'} ${o.losses.some((l) => l.to != null) ? 'убрали или передвинули' : 'убрали'}. Сыграть прерывание?`;
  return (
    <Collapsible id={JSON.stringify(o.options)} title="прерывание" className="respond-box offer-box">
        <div className="offer-cards">{cards.map((c) => <img key={c} className="respond-card" src={cardImg(c)} alt={nameOfCard(c)} />)}</div>
        <div className="respond-body">
          <h3>{text}</h3>
          {o.options.map((x) => (
            <button key={x} className={`btn ${x === 'none' ? 'ghost' : ''}`} onClick={() => moves.interrupt(x)}>{o.labels[x] ?? x}</button>
          ))}
        </div>
    </Collapsible>
  );
}

/** Показ скрытого: только тому, кто отвечает. */
export function RevealModal({ G, me, moves }: { G: AMState; me: string | null; moves: any }) {
  const p = G.prompt;
  if (!p || p.kind !== 'reveal' || p.actor !== me || !p.reveal) return null;
  const ok = p.options.length === 1 && p.options[0] === 'ok';
  return (
    <Collapsible id={`${p.cardId}:${p.step}`} title={p.text} className="reveal-box">
        <h3>{p.text}</h3>
        <div className="reveal">
          {p.reveal.map((id) => (
            <figure key={id}>
              {ok
                ? <img src={imgOf(id)} alt={nameOfCard(id)} />
                : <button className="hand-card" onClick={() => moves.answer(id)}><img src={imgOf(id)} alt={nameOfCard(id)} /></button>}
            </figure>
          ))}
        </div>
        {ok && <button className="btn" onClick={() => moves.answer('ok')}>Понятно</button>}
    </Collapsible>
  );
}

/** Хотсит: передать компьютер отвечающему. */
export function Handoff({ name, onReady }: { name: string; onReady: () => void }) {
  return (
    <div className="popup handoff">
      <div className="popup-box">
        <h2>Отвечает {name}</h2>
        <p>Передайте ему компьютер.</p>
        <button className="btn" onClick={onReady}>Я {name}, показать</button>
      </div>
    </div>
  );
}
