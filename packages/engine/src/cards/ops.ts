import type { AMState, AreaId, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { CARD_BY_ID } from '../data/cards';
import { log, nameOf } from '../helpers';
import { removeTarget, troubleEnter, troubleLeave } from '../rules';
import type { EffectApi, Next, PromptSpec } from './run';

export type PieceKind = 'minion' | 'demon' | 'troll' | 'building';
export interface PieceRef { area: AreaId; kind: PieceKind; owner?: PlayerID }

export const pieceKey = (p: PieceRef): string => `${p.area}:${p.kind}:${p.owner ?? ''}`;
export function parsePiece(key: string): PieceRef {
  const [a, kind, owner] = key.split(':');
  return { area: Number(a), kind: kind as PieceKind, owner: owner || undefined };
}

/** Фишки на поле, подходящие под фильтр, — ключами pieceKey. */
export function pieces(G: AMState, filter: (p: PieceRef) => boolean): string[] {
  const out: PieceRef[] = [];
  for (const id of AREA_IDS) {
    const a = G.areas[id];
    for (const [owner, n] of Object.entries(a.minions)) if (n > 0) out.push({ area: id, kind: 'minion', owner });
    if (a.demons > 0) out.push({ area: id, kind: 'demon' });
    if (a.trolls > 0) out.push({ area: id, kind: 'troll' });
    if (a.building) out.push({ area: id, kind: 'building', owner: a.building });
  }
  return out.filter(filter).map(pieceKey);
}

export const isMinionLike = (p: PieceRef) => p.kind !== 'building';

export function pieceName(G: AMState, p: PieceRef): string {
  const where = areaDef(p.area).name;
  if (p.kind === 'minion') return `слуга ${nameOf(G, p.owner!)} (${where})`;
  if (p.kind === 'building') return `здание ${nameOf(G, p.owner!)} (${where})`;
  return `${p.kind === 'demon' ? 'демон' : 'тролль'} (${where})`;
}

export function removePiece(G: AMState, p: PieceRef): void {
  if (p.kind === 'building') {
    G.players[p.owner!].buildingSupply++;
    G.areas[p.area].building = null;
    return;
  }
  removeTarget(G, p.area, p.kind === 'minion' ? { kind: 'minion', owner: p.owner! } : { kind: p.kind });
}

/** Перемещение слуги по правилам беспорядков (уход снимает, вход в занятый район кладёт). */
export function moveMinion(G: AMState, owner: PlayerID, from: AreaId, to: AreaId): void {
  const a = G.areas[from];
  a.minions[owner]--;
  troubleLeave(a);
  const b = G.areas[to];
  troubleEnter(b);
  b.minions[owner]++;
}

/** Слуга из запаса в район; trouble=false — без жетона беспорядка. */
export function putMinion(G: AMState, owner: PlayerID, area: AreaId, trouble = true): boolean {
  const p = G.players[owner];
  if (p.minionSupply < 1) return false;
  p.minionSupply--;
  const a = G.areas[area];
  if (trouble) troubleEnter(a);
  a.minions[owner]++;
  return true;
}

/** Перевод денег «если есть»: переводится не больше, чем у отправителя. Возвращает сумму. */
export function pay(G: AMState, from: PlayerID | 'bank', to: PlayerID | 'bank', amount: number): number {
  const n = from === 'bank' ? amount : Math.min(amount, G.players[from].money);
  if (from !== 'bank') G.players[from].money -= n;
  if (to !== 'bank') G.players[to].money += n;
  return n;
}

export function moveCards(G: AMState, from: PlayerID, to: PlayerID | 'discard', cards: string[]): void {
  const hand = G.players[from].hand;
  for (const c of cards) {
    hand.splice(hand.indexOf(c), 1);
    if (to === 'discard') G.discard.push(c);
    else G.players[to].hand.push(c);
  }
}

export const cardNames = (cards: string[]) => cards.map((c) => `«${CARD_BY_ID[c]?.name ?? c}»`).join(', ');

/** Строка лога от имени игрока, разыгрывающего карту. */
export function say(api: EffectApi, text: string): void {
  const card = api.G.play ? CARD_BY_ID[api.G.play.cardId]?.name : '';
  log(api.G, `${card ? `«${card}» — ` : ''}${nameOf(api.G, api.pid)}: ${text}`);
}

/** Вопрос или null, если выбирать не из чего (часть эффекта пропускается). */
export function ask(api: EffectApi, spec: Omit<PromptSpec, 'actor'> & { actor?: PlayerID }): Next {
  const full = { actor: api.pid, ...spec } as PromptSpec;
  if (full.kind === 'hand') {
    const n = api.G.players[full.actor].hand.length;
    if (n === 0 || (full.max ?? n) === 0) {
      log(api.G, `У ${nameOf(api.G, full.actor)} нет карт — часть эффекта пропущена`);
      return null;
    }
    return { ...full, options: [], min: Math.min(full.min ?? 0, n), max: Math.min(full.max ?? n, n) };
  }
  if (full.kind !== 'reveal' && full.options.length === 0) {
    log(api.G, 'Нет подходящих вариантов — часть эффекта пропущена');
    return null;
  }
  return full;
}
