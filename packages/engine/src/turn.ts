import type { AMState, AreaId, CardSymbol, PlayerID, SymbolKind, Target } from './types';
import { HAND_SIZE } from './types';
import { CARD_BY_ID, EVENT_BY_ID } from './data/cards';
import { areaDef } from './data/areas';
import { drawCards, log, nameOf } from './helpers';
import { assassinate, buildIn, placeMinion, removeTroubleIn } from './rules';

export function startTurn(G: AMState): void {
  G.play = null;
  G.playsLeft = 1;
  G.cardsPlayed = 0;
  G.lastEvent = null;
}

export function currentSymbol(G: AMState): CardSymbol | undefined {
  return G.play?.queue[0];
}

function finishIfDone(G: AMState): void {
  if (G.play && G.play.queue.length === 0) {
    if (G.play.giveTo) G.players[G.play.giveTo].hand.push(G.play.cardId);
    else G.discard.push(G.play.cardId);
    G.play = null;
  }
}

function expectSymbol(G: AMState, kind: SymbolKind): string | null {
  return currentSymbol(G)?.kind === kind ? null : 'Сейчас другое действие';
}

function advance(G: AMState): void {
  G.play!.queue.shift();
  finishIfDone(G);
}

export function playCard(G: AMState, pid: PlayerID, cardId: string): string | null {
  if (G.play) return 'Сначала доиграйте текущую карту';
  if (G.playsLeft < 1) return 'Больше нельзя играть карты';
  const hand = G.players[pid].hand;
  const i = hand.indexOf(cardId);
  if (i < 0 || !CARD_BY_ID[cardId]) return 'Такой карты нет в руке';
  hand.splice(i, 1);
  G.playsLeft--;
  G.cardsPlayed++;
  G.play = { cardId, queue: CARD_BY_ID[cardId].symbols.map((s) => ({ ...s })) };
  log(G, `${nameOf(G, pid)} играет «${CARD_BY_ID[cardId].name}»`);
  finishIfDone(G);
  return null;
}

export function doMinion(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const e = expectSymbol(G, 'minion') ?? placeMinion(G, pid, area, from);
  if (e) return e;
  log(G, `${nameOf(G, pid)} ставит слугу: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doBuild(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const e = expectSymbol(G, 'building') ?? buildIn(G, pid, area, from);
  if (e) return e;
  log(G, `${nameOf(G, pid)} строит здание: ${areaDef(area).name} (−$${areaDef(area).cost})`);
  advance(G);
  return null;
}

export function doAssassinate(G: AMState, pid: PlayerID, area: AreaId, target: Target): string | null {
  const e = expectSymbol(G, 'assassinate') ?? assassinate(G, pid, area, target);
  if (e) return e;
  const victim = target.kind === 'minion' ? `слугу ${nameOf(G, target.owner)}` : target.kind === 'demon' ? 'демона' : 'тролля';
  log(G, `${nameOf(G, pid)} убирает ${victim}: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doRemoveTrouble(G: AMState, pid: PlayerID, area: AreaId): string | null {
  const e = expectSymbol(G, 'removeTrouble') ?? removeTroubleIn(G, area);
  if (e) return e;
  log(G, `${nameOf(G, pid)} убирает беспорядок: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doMoney(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'money');
  if (e) return e;
  const amount = currentSymbol(G)!.amount ?? 0;
  G.players[pid].money += amount;
  log(G, `${nameOf(G, pid)} берёт из банка $${amount}`);
  advance(G);
  return null;
}

export function doPlayAnother(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'playAnother');
  if (e) return e;
  G.playsLeft++;
  advance(G);
  return null;
}

export function doEvent(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'event');
  if (e) return e;
  const ev = G.events.shift();
  if (ev) {
    G.lastEvent = ev;
    log(G, `Случайное событие: «${EVENT_BY_ID[ev].name}» — выполните его вручную`);
  } else {
    log(G, 'Случайные события закончились');
  }
  advance(G);
  return null;
}

export function skipSymbol(G: AMState, pid: PlayerID): string | null {
  const s = currentSymbol(G);
  if (!s) return 'Нет действия';
  if (s.kind === 'event') return 'Случайное событие нельзя пропустить';
  advance(G);
  return null;
}

export function canEndTurn(G: AMState, pid: PlayerID): string | null {
  if (G.play) return 'Сначала доиграйте карту';
  if (G.cardsPlayed === 0 && G.players[pid].hand.length > 0) return 'Сначала сыграйте карту';
  return null;
}

export function refillHand(G: AMState, pid: PlayerID): void {
  const need = HAND_SIZE - G.players[pid].hand.length;
  if (need > 0) drawCards(G, pid, need);
}
