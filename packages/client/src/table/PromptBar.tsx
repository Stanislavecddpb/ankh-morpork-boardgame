import { CARD_BY_ID, currentSymbol, hasEffect, type AMState } from '@am/engine';
import { COLOR_HEX } from './assets';

/** Плашка над полем: что делать сейчас по тексту карты. */
export function PromptBar({ G, ctx, me, moves, nameOf }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
}) {
  const p = G.prompt;
  const sym = currentSymbol(G);
  if (!G.play || (!p && sym?.kind !== 'scroll')) return null;
  const card = CARD_BY_ID[G.play.cardId];
  const myTurn = me === ctx.currentPlayer;
  const auto = hasEffect(G.play.cardId);

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
    body = <span>Ждём ответа: {nameOf(p.actor)}…</span>;
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
      <b>«{card?.name}»</b>
      {body}
      {myTurn && p && !p.locked && <button className="btn ghost" onClick={() => moves.skipSymbol()}>Пропустить</button>}
    </div>
  );
}
