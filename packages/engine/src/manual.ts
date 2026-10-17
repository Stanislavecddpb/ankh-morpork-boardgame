import type { AMState, AreaId, PersonalityId, PlayerID } from './types';
import { MAX_DEMONS, MAX_TROLLS } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { CARD_BY_ID, EVENT_BY_ID } from './data/cards';
import { log, nameOf } from './helpers';
import { allPersonalities, scoreResult } from './victory';

export type ManualAction =
  | { type: 'minion'; area: AreaId; owner: PlayerID; delta: 1 | -1 }
  | { type: 'building'; area: AreaId; owner: PlayerID | null }
  | { type: 'trouble'; area: AreaId; on: boolean }
  | { type: 'demon'; area: AreaId; delta: 1 | -1 }
  | { type: 'troll'; area: AreaId; delta: 1 | -1 }
  | { type: 'money'; from: PlayerID | 'bank'; to: PlayerID | 'bank'; amount: number }
  | { type: 'loan'; player: PlayerID; delta: 1 | -1 }
  | { type: 'discard'; cardId: string }
  | { type: 'give'; cardId: string; to: PlayerID }
  | { type: 'takeDiscard'; cardId: string }
  | { type: 'givePlayed'; to: PlayerID }
  | { type: 'movePiece'; from: AreaId; to: AreaId; piece: 'minion' | 'building' | 'demon' | 'troll' | 'trouble'; owner?: PlayerID }
  | { type: 'returnToDeck'; cardId: string; where: 'top' | 'bottom' }
  | { type: 'toFront'; cardId: string; player: PlayerID }
  | { type: 'fromFront'; player: PlayerID; cardId: string; to: 'discard' | 'hand' }
  | { type: 'returnPlayed' }
  | { type: 'dropEvent' }
  | { type: 'extraPlay' }
  | { type: 'declareEnd'; winner: PlayerID | null };

const sign = (d: number) => (d > 0 ? '+' : '−');

/** Ручная правка состояния (для текстов карт и событий, которые пока не автоматизированы). */
export function applyManual(G: AMState, pid: PlayerID, a: ManualAction): string | null {
  const who = `✋ ${nameOf(G, pid)}`;
  const holder = (p: PlayerID | 'bank') => (p === 'bank' ? 'банк' : nameOf(G, p));

  switch (a.type) {
    case 'minion': {
      const area = G.areas[a.area];
      const owner = G.players[a.owner];
      if (!area || !owner) return 'Нет такого района или игрока';
      if (a.delta > 0) {
        if (owner.minionSupply < 1) return 'Нет слуг в запасе';
        owner.minionSupply--;
        area.minions[a.owner]++;
      } else {
        if (area.minions[a.owner] < 1) return 'Там нет такого слуги';
        area.minions[a.owner]--;
        owner.minionSupply++;
      }
      log(G, `${who}: ${sign(a.delta)}слуга ${nameOf(G, a.owner)}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'building': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      if (area.building === a.owner) return 'Ничего не меняется';
      if (a.owner !== null) {
        const owner = G.players[a.owner];
        if (!owner || owner.buildingSupply < 1) return 'Нет зданий в запасе';
        owner.buildingSupply--;
      }
      if (area.building !== null) G.players[area.building].buildingSupply++;
      area.building = a.owner;
      log(G, `${who}: здание в «${areaDef(a.area).name}» — ${a.owner === null ? 'убрано' : nameOf(G, a.owner)}`);
      return null;
    }
    case 'trouble': {
      if (!G.areas[a.area]) return 'Нет такого района';
      G.areas[a.area].trouble = a.on;
      log(G, `${who}: беспорядок ${a.on ? 'положен' : 'убран'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'demon':
    case 'troll': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      const key = a.type === 'demon' ? 'demons' : 'trolls';
      const max = a.type === 'demon' ? MAX_DEMONS : MAX_TROLLS;
      const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id][key], 0);
      if (a.delta > 0 && onBoard >= max) return 'Все такие фишки уже на поле';
      if (a.delta < 0 && area[key] < 1) return 'Здесь их нет';
      area[key] += a.delta;
      log(G, `${who}: ${sign(a.delta)}${a.type === 'demon' ? 'демон' : 'тролль'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'money': {
      if (!Number.isInteger(a.amount) || a.amount <= 0) return 'Неверная сумма';
      if (a.from === a.to) return 'Отправитель и получатель совпадают';
      if (a.from !== 'bank') {
        const from = G.players[a.from];
        if (!from) return 'Нет такого игрока';
        if (from.money < a.amount) return 'Не хватает денег';
        from.money -= a.amount;
      }
      if (a.to !== 'bank') {
        if (!G.players[a.to]) return 'Нет такого игрока';
        G.players[a.to].money += a.amount;
      }
      log(G, `${who}: $${a.amount} ${holder(a.from)} → ${holder(a.to)}`);
      return null;
    }
    case 'loan': {
      const p = G.players[a.player];
      if (!p) return 'Нет такого игрока';
      if (a.delta < 0 && p.loans < 1) return 'Займов нет';
      p.loans += a.delta;
      log(G, `${who}: ${a.delta > 0 ? 'займ взят' : 'займ погашен'} — ${nameOf(G, a.player)}`);
      return null;
    }
    case 'discard': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      hand.splice(i, 1);
      G.discard.push(a.cardId);
      log(G, `${who}: сбрасывает «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
    case 'give': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      if (!G.players[a.to] || a.to === pid) return 'Некому передать';
      hand.splice(i, 1);
      G.players[a.to].hand.push(a.cardId);
      log(G, `${who}: передаёт карту игроку ${nameOf(G, a.to)}`);
      return null;
    }
    case 'movePiece': {
      const from = G.areas[a.from];
      const to = G.areas[a.to];
      if (!from || !to || a.from === a.to) return 'Неверные районы';
      const where = `${areaDef(a.from).name} → ${areaDef(a.to).name}`;
      if (a.piece === 'minion') {
        if (!a.owner || !(from.minions[a.owner] > 0)) return 'Там нет такого слуги';
        from.minions[a.owner]--;
        to.minions[a.owner]++;
        log(G, `${who}: слуга ${nameOf(G, a.owner)} ${where}`);
      } else if (a.piece === 'building') {
        if (!from.building || to.building) return 'Здание не переносится';
        to.building = from.building;
        from.building = null;
        log(G, `${who}: здание ${nameOf(G, to.building)} ${where}`);
      } else if (a.piece === 'trouble') {
        if (!from.trouble) return 'Там нет беспорядка';
        from.trouble = false;
        to.trouble = true;
        log(G, `${who}: беспорядок ${where}`);
      } else {
        const key = a.piece === 'demon' ? 'demons' : 'trolls';
        if (from[key] < 1) return 'Там их нет';
        from[key]--;
        to[key]++;
        log(G, `${who}: ${a.piece === 'demon' ? 'демон' : 'тролль'} ${where}`);
      }
      return null;
    }
    case 'returnToDeck': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      hand.splice(i, 1);
      if (a.where === 'top') G.deck.unshift(a.cardId);
      else G.deck.push(a.cardId);
      log(G, `${who}: кладёт карту ${a.where === 'top' ? 'наверх' : 'под низ'} колоды`);
      return null;
    }
    case 'toFront': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0 || !G.players[a.player]) return 'Нельзя';
      hand.splice(i, 1);
      G.players[a.player].front.push(a.cardId);
      log(G, `${who}: кладёт «${CARD_BY_ID[a.cardId]?.name}» перед игроком ${nameOf(G, a.player)}`);
      return null;
    }
    case 'fromFront': {
      const front = G.players[a.player]?.front;
      const i = front ? front.indexOf(a.cardId) : -1;
      if (i < 0) return 'Такой карты там нет';
      front!.splice(i, 1);
      if (a.to === 'hand') G.players[pid].hand.push(a.cardId);
      else G.discard.push(a.cardId);
      log(G, `${who}: «${CARD_BY_ID[a.cardId]?.name}» из-перед ${nameOf(G, a.player)} — ${a.to === 'hand' ? 'себе в руку' : 'в сброс'}`);
      return null;
    }
    case 'returnPlayed': {
      if (!G.play) return 'Сейчас нет разыгрываемой карты';
      G.players[pid].hand.push(G.play.cardId);
      log(G, `${who}: возвращает «${CARD_BY_ID[G.play.cardId]?.name}» в руку`);
      G.play = null;
      G.prompt = null;
      G.playsLeft++;
      G.cardsPlayed = Math.max(0, G.cardsPlayed - 1);
      return null;
    }
    case 'dropEvent': {
      if (!G.lastEvent) return 'Нет вытянутого события';
      log(G, `${who}: событие «${EVENT_BY_ID[G.lastEvent]?.name}» убрано из игры`);
      G.lastEvent = null;
      return null;
    }
    case 'extraPlay': {
      G.playsLeft++;
      log(G, `${who}: можно сыграть ещё одну карту`);
      return null;
    }
    case 'declareEnd': {
      G.gameover = a.winner === null
        ? scoreResult(G)
        : { winner: a.winner, reason: 'manual', personalities: allPersonalities(G) };
      log(G, `${who}: игра окончена ${a.winner === null ? '(подсчёт очков)' : `— победитель ${nameOf(G, a.winner)}`}`);
      return null;
    }
    case 'givePlayed': {
      if (!G.play) return 'Сейчас не разыгрывается карта';
      if (!G.players[a.to] || a.to === pid) return 'Некому передать';
      G.play.giveTo = a.to;
      log(G, `${who}: «${CARD_BY_ID[G.play.cardId]?.name ?? G.play.cardId}» после розыгрыша уйдёт в руку игроку ${nameOf(G, a.to)}`);
      return null;
    }
    case 'takeDiscard': {
      const i = G.discard.lastIndexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в сбросе';
      G.discard.splice(i, 1);
      G.players[pid].hand.push(a.cardId);
      log(G, `${who}: берёт из сброса «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
  }
}

type Shuffle = <T>(arr: T[]) => T[];

/** Взять случайную карту из руки другого игрока себе. */
export function takeRandomCard(G: AMState, pid: PlayerID, from: PlayerID, shuffle: Shuffle): string | null {
  const hand = G.players[from]?.hand;
  if (!hand?.length || from === pid) return 'Не у кого брать';
  const card = shuffle(hand)[0];
  hand.splice(hand.indexOf(card), 1);
  G.players[pid].hand.push(card);
  log(G, `✋ ${nameOf(G, pid)}: берёт случайную карту у ${nameOf(G, from)}`);
  return null;
}

/** Вернуть вытянутое событие в колоду событий: наверх или замешав. */
export function eventBack(G: AMState, pid: PlayerID, where: 'top' | 'shuffle', shuffle: Shuffle): string | null {
  if (!G.lastEvent) return 'Нет вытянутого события';
  const ev = G.lastEvent;
  G.lastEvent = null;
  G.events = where === 'top' ? [ev, ...G.events] : shuffle([...G.events, ev]);
  log(G, `✋ ${nameOf(G, pid)}: событие «${EVENT_BY_ID[ev]?.name}» возвращено в колоду${where === 'top' ? ' наверх' : ''}`);
  return null;
}

/** Заменить свою личность случайной неиспользованной (Зорго). */
export function swapPersonality(G: AMState, pid: PlayerID, shuffle: Shuffle): string | null {
  if (!G.spare.length) return 'Неиспользованных личностей нет';
  const pick = shuffle(G.spare)[0] as PersonalityId;
  const mine = G.players[pid].personality!;
  G.spare = G.spare.map((s) => (s === pick ? mine : s));
  G.players[pid].personality = pick;
  log(G, `✋ ${nameOf(G, pid)}: меняет свою личность на случайную`);
  return null;
}

/** Показать себе неиспользованные личности (Миссис Кейк). */
export function peekSpare(G: AMState, pid: PlayerID): string | null {
  G.peek = { player: pid, cards: [...G.spare] };
  log(G, `✋ ${nameOf(G, pid)}: смотрит неиспользованные личности`);
  return null;
}
