import { CARD_BY_ID, currentSymbol, effectTitle, hasEffect, type AMState } from '@am/engine';
import { useEffect, useState } from 'react';
import { COLOR_HEX } from './assets';

const ABSENT_MS = 30000;

/** true, когда ожидание с этим ключом длится дольше ABSENT_MS. */
function useWaitedLong(key: string | null): boolean {
  const [long, setLong] = useState(false);
  useEffect(() => {
    setLong(false);
    if (!key) return;
    const t = setTimeout(() => setLong(true), ABSENT_MS);
    return () => clearTimeout(t);
  }, [key]);
  return long;
}

/** Плашка над полем: что делать сейчас по тексту карты. */
export function PromptBar({ G, ctx, me, moves, nameOf }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
}) {
  const p = G.prompt;
  const sym = currentSymbol(G);
  const o = G.offers[0];
  const myTurn = me === ctx.currentPlayer;
  // Кого ждёт текущий игрок: решение о прерывании или ответ на вопрос карты.
  const waitFor = o ? o.player : p && p.actor !== me ? p.actor : null;
  const waitKey = waitFor && myTurn ? `${ctx.turn}:${waitFor}:${o ? JSON.stringify(o.options) : `${p!.cardId}:${p!.step}`}` : null;
  const long = useWaitedLong(waitKey);
  const absent = long && waitFor && (
    <button className="btn absent" title="Если игрок отошёл: выбрать за него самый безобидный вариант"
      onClick={() => moves.answerFor()}>Ответить за {nameOf(waitFor)}</button>
  );
  if (o && o.player !== me) {
    return <div className="prompt-bar"><b>Прерывание</b><span>Ждём ответа: {nameOf(o.player)}…</span>{absent}</div>;
  }
  if (o) return null;
  if (!p && (!G.play || sym?.kind !== 'scroll')) return null;
  const title = p ? effectTitle(p.cardId) : CARD_BY_ID[G.play!.cardId]?.name;
  const auto = !!G.play && hasEffect(G.play.cardId);

  let body: React.ReactNode;
  if (!p) {
    body = myTurn ? (
      <>
        <span>{auto ? 'Разыграть текст карты?' : 'Текст карты выполняется вручную (✋)'}</span>
        {auto && <button className="btn" onClick={() => moves.startScroll()}>Выполнить</button>}
        <button className="btn ghost" onClick={() => moves.skipSymbol()}>{auto ? 'Пропустить' : 'Готово'}</button>
      </>
    ) : <span>{nameOf(ctx.currentPlayer)} разыгрывает текст карты…</span>;
  } else if (p.actor !== me) {
    body = <><span>Ждём ответа: {nameOf(p.actor)}…</span>{absent}</>;
  } else {
    body = (
      <>
        <span>{p.text}</span>
        {p.kind === 'player' && p.options.map((o) => (
          <button key={o} className="btn player-pick"
            style={{ borderColor: COLOR_HEX[G.players[String(o)]?.color ?? 'red'] }}
            onClick={() => moves.answer(o)}>{nameOf(String(o))}</button>
        ))}
        {p.kind === 'choice' && p.actor === ctx.currentPlayer && p.options.map((o) => (
          <button key={o} className="btn" onClick={() => moves.answer(o)}>{p.labels?.[o] ?? o}</button>
        ))}
        {(p.kind === 'area' || p.kind === 'piece') && <i>— выберите на поле</i>}
        {p.kind === 'hand' && p.actor === ctx.currentPlayer && <i>— выберите карты в руке</i>}
      </>
    );
  }

  return (
    <div className="prompt-bar">
      <b>«{title}»</b>
      {body}
      {myTurn && p && !p.locked && <button className="btn ghost" onClick={() => moves.skipSymbol()}>Пропустить</button>}
    </div>
  );
}
