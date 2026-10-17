import { useState } from 'react';
import { CARD_BY_ID, HIDDEN_CARD, areaDef, type AMState, type AreaId, type ManualAction } from '@am/engine';

export function ManualPanel({ G, me, moves, nameOf, on, setOn }: {
  G: AMState; me: string; moves: any; nameOf: (pid: string) => string; on: boolean; setOn: (v: boolean) => void;
}) {
  const pids = Object.keys(G.players);
  const [from, setFrom] = useState<string>('bank');
  const [to, setTo] = useState<string>(me);
  const [amount, setAmount] = useState(1);
  const [card, setCard] = useState('');
  const [giveTo, setGiveTo] = useState(pids.find((p) => p !== me) ?? me);
  const [fromDiscard, setFromDiscard] = useState('');
  const hand = G.players[me].hand.filter((c) => c !== HIDDEN_CARD);
  const act = (a: ManualAction) => moves.manual(a);
  const who = (p: string) => (p === 'bank' ? 'Банк' : nameOf(p));

  return (
    <div className={`manual ${on ? 'on' : ''}`}>
      <button className="btn" onClick={() => setOn(!on)}>✋ {on ? 'Выйти из ручного режима' : 'Ручной режим'}</button>
      {on && (
        <div className="manual-body">
          <div className="manual-hint">Клик по району — фишки и беспорядки. Всё пишется в лог.</div>
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
            Займы {nameOf(me)}: {G.players[me].loans}
            <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: -1 })}>−</button>
            <button className="btn small" onClick={() => moves.manualDraw()}>Взять карту из колоды</button>
          </div>
          <div className="manual-row">
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">— карта из руки —</option>
              {hand.map((c, i) => <option key={`${c}-${i}`} value={c}>{CARD_BY_ID[c]?.name ?? c}</option>)}
            </select>
            <button className="btn small" disabled={!card} onClick={() => { act({ type: 'discard', cardId: card }); setCard(''); }}>Сбросить</button>
            <select value={giveTo} onChange={(e) => setGiveTo(e.target.value)}>
              {pids.filter((p) => p !== me).map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
            </select>
            <button className="btn small" disabled={!card} onClick={() => { act({ type: 'give', cardId: card, to: giveTo }); setCard(''); }}>Передать</button>
          </div>
          <div className="manual-row">
            <select value={fromDiscard} onChange={(e) => setFromDiscard(e.target.value)}>
              <option value="">— карта из сброса —</option>
              {[...new Set(G.discard)].reverse().map((c) => <option key={c} value={c}>{CARD_BY_ID[c]?.name ?? c}</option>)}
            </select>
            <button className="btn small" disabled={!fromDiscard} onClick={() => { act({ type: 'takeDiscard', cardId: fromDiscard }); setFromDiscard(''); }}>Взять из сброса</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ManualAreaMenu({ G, area, moves, nameOf, onClose }: {
  G: AMState; area: AreaId; moves: any; nameOf: (pid: string) => string; onClose: () => void;
}) {
  const a = G.areas[area];
  const act = (x: ManualAction) => moves.manual(x);
  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>✋ {areaDef(area).name}</h3>
        {Object.keys(G.players).map((pid) => (
          <div key={pid} className="manual-row">
            <span className="grow">Слуги {nameOf(pid)}: {a.minions[pid]}</span>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: -1 })}>−</button>
          </div>
        ))}
        <div className="manual-row">
          <span className="grow">Здание</span>
          <select value={a.building ?? ''} onChange={(e) => act({ type: 'building', area, owner: e.target.value || null })}>
            <option value="">нет</option>
            {Object.keys(G.players).map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
          </select>
        </div>
        <div className="manual-row">
          <span className="grow">Беспорядок: {a.trouble ? 'есть' : 'нет'}</span>
          <button className="btn small" onClick={() => act({ type: 'trouble', area, on: !a.trouble })}>{a.trouble ? 'Убрать' : 'Положить'}</button>
        </div>
        <div className="manual-row">
          <span className="grow">Демоны: {a.demons}</span>
          <button className="btn small" onClick={() => act({ type: 'demon', area, delta: 1 })}>+</button>
          <button className="btn small" onClick={() => act({ type: 'demon', area, delta: -1 })}>−</button>
        </div>
        <div className="manual-row">
          <span className="grow">Тролли: {a.trolls}</span>
          <button className="btn small" onClick={() => act({ type: 'troll', area, delta: 1 })}>+</button>
          <button className="btn small" onClick={() => act({ type: 'troll', area, delta: -1 })}>−</button>
        </div>
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
