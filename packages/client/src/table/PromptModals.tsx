import { createContext, useState } from 'react';
import { CARD_BY_ID, PERSONALITY_BY_ID, type AMState, type PersonalityId } from '@am/engine';
import { cardImg, effectImg, personalityImg } from './assets';

/** В хотсите — переключить «сиденье» клиента на игрока. */
export const SeatContext = createContext<((pid: string) => void) | null>(null);

const imgOf = (id: string) => (id in PERSONALITY_BY_ID ? personalityImg(id as PersonalityId) : cardImg(id));
const nameOfCard = (id: string) => PERSONALITY_BY_ID[id as PersonalityId]?.name ?? CARD_BY_ID[id]?.name ?? id;

/** Вопрос сопернику (кнопки или выбор карт из его руки) — у того, кто отвечает. */
export function RespondModal({ G, ctx, me, moves }: { G: AMState; ctx: any; me: string | null; moves: any }) {
  const p = G.prompt;
  const [picked, setPicked] = useState<string[]>([]);
  if (!p || !me || p.actor !== me || p.actor === ctx.currentPlayer || (p.kind !== 'choice' && p.kind !== 'hand')) return null;
  const hand = G.players[me].hand;
  const toggle = (c: string) =>
    setPicked((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < (p.max ?? 99) ? [...x, c] : x));
  return (
    <div className="popup">
      <div className="popup-box respond-box">
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
      </div>
    </div>
  );
}

/** Показ скрытого: только тому, кто отвечает. */
export function RevealModal({ G, me, moves }: { G: AMState; me: string | null; moves: any }) {
  const p = G.prompt;
  if (!p || p.kind !== 'reveal' || p.actor !== me || !p.reveal) return null;
  const ok = p.options.length === 1 && p.options[0] === 'ok';
  return (
    <div className="popup">
      <div className="popup-box reveal-box">
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
      </div>
    </div>
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
