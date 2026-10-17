import { CARD_BY_ID, EVENT_BY_ID, areaDef, canEndTurn, currentSymbol, type AMState, type CardSymbol } from '@am/engine';
import { ZoomImg } from './ZoomImg';
import { cardImg, eventImg } from './assets';

const LABEL: Record<CardSymbol['kind'], string> = {
  minion: 'Поставить слугу', building: 'Построить здание', assassinate: 'Убийство',
  removeTrouble: 'Убрать беспорядок', money: 'Взять деньги', scroll: 'Текст карты',
  event: 'Случайное событие', playAnother: 'Сыграть ещё карту', interrupt: 'Прерывание',
};

const label = (s: CardSymbol) => (s.kind === 'money' ? `Взять $${s.amount}` : LABEL[s.kind]);

export function ActionPanel({ G, ctx, me, moves, undo, nameOf, from }: {
  G: AMState; ctx: any; me: string | null; moves: any; undo: () => void;
  nameOf: (pid: string) => string; from: number | null;
}) {
  const myTurn = me === ctx.currentPlayer && !ctx.gameover;
  const sym = currentSymbol(G);

  return (
    <section className="action">
      {G.play && (
        <div className="in-play">
          <ZoomImg className="in-play-card" src={cardImg(G.play.cardId)} alt={CARD_BY_ID[G.play.cardId]?.name} />
          <ol className="queue">
            {G.play.queue.map((s, i) => <li key={i} className={i === 0 ? 'now' : ''}>{label(s)}</li>)}
          </ol>
        </div>
      )}

      {G.lastEvent && (
        <div className="event">
          <ZoomImg src={eventImg(G.lastEvent)} alt="" />
          <div>
            <b>Событие «{EVENT_BY_ID[G.lastEvent]?.name}»</b>
            {G.eventRolls.length > 0 && <div>Кубик: {G.eventRolls.map((r) => `${r} (${areaDef(r).name})`).join(', ')}</div>}
          </div>
        </div>
      )}

      {!myTurn && !ctx.gameover && <div className="hint">Ходит {nameOf(ctx.currentPlayer)}…</div>}

      {myTurn && sym && (
        <div className="hint">
          {(sym.kind === 'minion' || sym.kind === 'building') && (from == null
            ? <>Выберите район на поле или перетащите фишку из запаса слева. {sym.kind === 'minion' && G.players[me!].minionSupply === 0 && 'Все слуги на поле — сначала выберите, кого переставить.'}{sym.kind === 'building' && G.players[me!].buildingSupply === 0 && 'Все здания на поле — сначала выберите, какое перенести.'}</>
            : <>Теперь выберите, куда.</>)}
          {sym.kind === 'assassinate' && 'Выберите район с беспорядком, затем жертву.'}
          {sym.kind === 'removeTrouble' && 'Выберите район с жетоном беспорядка.'}
          {sym.kind === 'scroll' && 'Текст карты — см. подсказку над полем.'}
          {sym.kind === 'interrupt' && 'Выполните текст карты вручную (✋), затем нажмите «Готово».'}
          <div className="buttons">
            {sym.kind === 'money' && <button className="btn" onClick={() => moves.takeMoney()}>{label(sym)}</button>}
            {sym.kind === 'playAnother' && <button className="btn" onClick={() => moves.playAnother()}>Можно сыграть ещё карту</button>}
            {sym.kind === 'event' && <button className="btn" onClick={() => moves.drawEvent()}>Тянуть событие</button>}
            {sym.kind === 'interrupt' && <button className="btn" onClick={() => moves.skipSymbol()}>Готово</button>}
            {sym.kind !== 'event' && sym.kind !== 'scroll' && sym.kind !== 'interrupt' && (
              <button className="btn ghost" onClick={() => moves.skipSymbol()}>Пропустить</button>
            )}
          </div>
        </div>
      )}

      {myTurn && !G.play && (
        <div className="hint">
          {G.playsLeft > 0 ? (G.cardsPlayed === 0 ? 'Сыграйте карту из руки.' : 'Можно сыграть ещё одну карту.') : 'Карты сыграны.'}
          <div className="buttons">
            <button className="btn" disabled={!!canEndTurn(G, me!)} onClick={() => moves.finishTurn()}>Закончить ход</button>
          </div>
        </div>
      )}

      {myTurn && <button className="btn ghost undo" onClick={() => undo()}>↶ Отменить</button>}
    </section>
  );
}
