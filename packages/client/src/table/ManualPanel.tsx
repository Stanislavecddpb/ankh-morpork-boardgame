import { useState } from 'react';
import {
  AREA_IDS, CARD_BY_ID, EVENT_BY_ID, HIDDEN_CARD, PERSONALITY_BY_ID, areaDef,
  type AMState, type AreaId, type ManualAction, type PersonalityId,
} from '@am/engine';
import { personalityImg } from './assets';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="manual-sec" open><summary>{title}</summary>{children}</details>;
}

export function ManualPanel({ G, me, moves, nameOf, on, setOn }: {
  G: AMState; me: string; moves: any; nameOf: (pid: string) => string; on: boolean; setOn: (v: boolean) => void;
}) {
  const pids = Object.keys(G.players);
  const others = pids.filter((p) => p !== me);
  const [from, setFrom] = useState<string>('bank');
  const [to, setTo] = useState<string>(me);
  const [amount, setAmount] = useState(1);
  const [card, setCard] = useState('');
  const [target, setTarget] = useState(others[0] ?? me);
  const [fromDiscard, setFromDiscard] = useState('');
  const [winner, setWinner] = useState('score');
  const hand = G.players[me].hand.filter((c) => c !== HIDDEN_CARD);
  const act = (a: ManualAction) => moves.manual(a);
  const who = (p: string) => (p === 'bank' ? 'Банк' : nameOf(p));
  const name = (c: string) => CARD_BY_ID[c]?.name ?? c;
  const playerSelect = (value: string, set: (v: string) => void, list = others) => (
    <select value={value} onChange={(e) => set(e.target.value)}>
      {list.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
    </select>
  );
  const withCard = (fn: () => void) => () => { if (card) { fn(); setCard(''); } };

  return (
    <div className={`manual ${on ? 'on' : ''}`}>
      <button className="btn" onClick={() => setOn(!on)}>✋ {on ? 'Выйти из ручного режима' : 'Ручной режим'}</button>
      {on && (
        <div className="manual-body">
          <div className="manual-hint">Клик по району — фишки, перемещение, беспорядки. Всё пишется в лог.</div>

          <Section title="Деньги">
            <div className="manual-row">
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {['bank', ...pids].map((p) => <option key={p} value={p}>{who(p)}</option>)}
              </select>
              →
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {['bank', ...pids].map((p) => <option key={p} value={p}>{who(p)}</option>)}
              </select>
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <button className="btn small" onClick={() => act({ type: 'money', from, to, amount })}>$ Перевести</button>
            </div>
            <div className="manual-row">
              Займы: {G.players[me].loans}
              <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: 1 })}>+</button>
              <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: -1 })}>−</button>
            </div>
          </Section>

          <Section title="Карты">
            <div className="manual-row">
              <select value={card} onChange={(e) => setCard(e.target.value)}>
                <option value="">— карта из руки —</option>
                {hand.map((c, i) => <option key={`${c}-${i}`} value={c}>{name(c)}</option>)}
              </select>
              {playerSelect(target, setTarget)}
            </div>
            <div className="manual-row">
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'discard', cardId: card }))}>В сброс</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'give', cardId: card, to: target }))}>Отдать игроку</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'toFront', cardId: card, player: target }))}>Перед игроком</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'toFront', cardId: card, player: me }))}>Перед собой</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'returnToDeck', cardId: card, where: 'top' }))}>Наверх колоды</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'returnToDeck', cardId: card, where: 'bottom' }))}>Под низ колоды</button>
            </div>
            <div className="manual-row">
              <button className="btn small" onClick={() => moves.manualDraw()}>Взять из колоды</button>
              <button className="btn small" onClick={() => moves.manualTakeRandom(target)}>Случайную у игрока</button>
            </div>
            <div className="manual-row">
              <select value={fromDiscard} onChange={(e) => setFromDiscard(e.target.value)}>
                <option value="">— карта из сброса —</option>
                {[...new Set(G.discard)].reverse().map((c) => <option key={c} value={c}>{name(c)}</option>)}
              </select>
              <button className="btn small" disabled={!fromDiscard} onClick={() => { act({ type: 'takeDiscard', cardId: fromDiscard }); setFromDiscard(''); }}>Взять из сброса</button>
            </div>
            {pids.flatMap((p) => G.players[p].front.map((c) => (
              <div key={`${p}-${c}`} className="manual-row">
                «{name(c)}» перед {nameOf(p)}:
                <button className="btn small" onClick={() => act({ type: 'fromFront', player: p, cardId: c, to: 'discard' })}>в сброс</button>
                <button className="btn small" onClick={() => act({ type: 'fromFront', player: p, cardId: c, to: 'hand' })}>себе в руку</button>
              </div>
            )))}
            {G.play && (
              <div className="manual-row">
                Разыгрывается «{name(G.play.cardId)}»:
                <button className="btn small" onClick={() => act({ type: 'returnPlayed' })}>Вернуть в руку</button>
                <button className="btn small" onClick={() => act({ type: 'givePlayed', to: target })}>
                  {G.play.giveTo ? `уйдёт: ${nameOf(G.play.giveTo)}` : 'После розыгрыша — игроку'}
                </button>
              </div>
            )}
          </Section>

          <Section title="События и личности">
            {G.lastEvent && (
              <div className="manual-row">
                «{EVENT_BY_ID[G.lastEvent]?.name}»:
                <button className="btn small" onClick={() => moves.manualEventBack('top')}>Наверх колоды</button>
                <button className="btn small" onClick={() => moves.manualEventBack('shuffle')}>Замешать</button>
                <button className="btn small" onClick={() => act({ type: 'dropEvent' })}>Убрать</button>
              </div>
            )}
            <div className="manual-row">
              <button className="btn small" onClick={() => moves.manualSwapPersonality()}>Сменить личность на случайную</button>
              <button className="btn small" onClick={() => moves.manualPeekSpare()}>Посмотреть неиспользованные</button>
            </div>
          </Section>

          <Section title="Ход и игра">
            <div className="manual-row">
              <button className="btn small" onClick={() => act({ type: 'extraPlay' })}>+1 карта</button>
              <button className="btn small" onClick={() => moves.manualRoll()}>🎲 Бросить кубик</button>
              <button className="btn small" onClick={() => moves.manualEndTurn()}>Закончить ход без добора</button>
            </div>
            <div className="manual-row">
              <select value={winner} onChange={(e) => setWinner(e.target.value)}>
                <option value="score">Подсчёт очков</option>
                {pids.map((p) => <option key={p} value={p}>Победитель: {nameOf(p)}</option>)}
              </select>
              <button className="btn small" onClick={() => { if (confirm('Закончить игру?')) act({ type: 'declareEnd', winner: winner === 'score' ? null : winner }); }}>Закончить игру</button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

const PIECES = [
  { piece: 'demon', label: 'Демон', key: 'demons' },
  { piece: 'troll', label: 'Тролль', key: 'trolls' },
] as const;

export function ManualAreaMenu({ G, area, moves, nameOf, onClose }: {
  G: AMState; area: AreaId; moves: any; nameOf: (pid: string) => string; onClose: () => void;
}) {
  const a = G.areas[area];
  const act = (x: ManualAction) => moves.manual(x);
  const [dest, setDest] = useState<AreaId>(AREA_IDS.find((id) => id !== area)!);
  const move = (piece: 'minion' | 'building' | 'demon' | 'troll' | 'trouble', owner?: string) =>
    act({ type: 'movePiece', from: area, to: dest, piece, owner });
  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>✋ {areaDef(area).name}</h3>
        <div className="manual-row">
          Переместить в:
          <select value={dest} onChange={(e) => setDest(Number(e.target.value))}>
            {AREA_IDS.filter((id) => id !== area).map((id) => <option key={id} value={id}>{areaDef(id).name}</option>)}
          </select>
        </div>
        {Object.keys(G.players).map((pid) => (
          <div key={pid} className="manual-row">
            <span className="grow">Слуги {nameOf(pid)}: {a.minions[pid]}</span>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: -1 })}>−</button>
            <button className="btn small" disabled={!a.minions[pid]} onClick={() => move('minion', pid)}>→</button>
          </div>
        ))}
        <div className="manual-row">
          <span className="grow">Здание</span>
          <select value={a.building ?? ''} onChange={(e) => act({ type: 'building', area, owner: e.target.value || null })}>
            <option value="">нет</option>
            {Object.keys(G.players).map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
          </select>
          <button className="btn small" disabled={!a.building} onClick={() => move('building')}>→</button>
        </div>
        <div className="manual-row">
          <span className="grow">Беспорядок: {a.trouble ? 'есть' : 'нет'}</span>
          <button className="btn small" onClick={() => act({ type: 'trouble', area, on: !a.trouble })}>{a.trouble ? 'Убрать' : 'Положить'}</button>
          <button className="btn small" disabled={!a.trouble} onClick={() => move('trouble')}>→</button>
        </div>
        {PIECES.map(({ piece, label, key }) => (
          <div key={piece} className="manual-row">
            <span className="grow">{label}: {a[key]}</span>
            <button className="btn small" onClick={() => act({ type: piece, area, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: piece, area, delta: -1 })}>−</button>
            <button className="btn small" disabled={!a[key]} onClick={() => move(piece)}>→</button>
          </div>
        ))}
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

/** Неиспользованные личности, которые игрок посмотрел вручную (видны только ему). */
export function PeekModal({ G, me }: { G: AMState; me: string | null }) {
  const [closed, setClosed] = useState('');
  const key = G.peek ? G.peek.cards.join(',') : '';
  if (!G.peek || G.peek.player !== me || closed === key) return null;
  return (
    <div className="popup" onClick={() => setClosed(key)}>
      <div className="popup-box reveal-box">
        <h3>Неиспользованные личности</h3>
        <div className="reveal">
          {G.peek.cards.map((c) => (
            <figure key={c}><img src={personalityImg(c as PersonalityId)} alt={PERSONALITY_BY_ID[c as PersonalityId]?.name} /></figure>
          ))}
        </div>
        <button className="btn" onClick={() => setClosed(key)}>Закрыть</button>
      </div>
    </div>
  );
}
