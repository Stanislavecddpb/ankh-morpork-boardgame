// Прерывания: пострадавшему от чужого действия предлагают сыграть подходящую карту из руки.
import type { AMState, AreaId, Loss, Offer, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { CARD_BY_ID } from '../data/cards';
import { log, nameOf } from '../helpers';
import { troubleEnter } from '../rules';
import { advanceSymbol } from '../turn';
import { answerPrompt, type EffectApi } from './run';

const GASPODE = 'gaspode';
const SUSAN = 'susan';
const SONKY = 'wallace-sonky';
const MOSSY = 'dr-mossy-lawn';
const RELOCATE = ['fresh-start-club', 'igor'];
const PREVENT = [GASPODE, SUSAN, SONKY];

/** События, от которых спасают Сьюзан, Клуб и Игорь (FAQ). */
export const LOSS_EVENTS = ['event:the-dragon', 'event:bloody-stupid-johnson', 'event:mysterious-murders'];

export const isInterrupt = (cardId: string) => !!CARD_BY_ID[cardId]?.symbols.some((s) => s.kind === 'interrupt');
export const hasCard = (G: AMState, pid: PlayerID, card: string) => !!G.players[pid]?.hand.includes(card);
const cardName = (id: string) => CARD_BY_ID[id]?.name ?? id;
const areaName = (id: AreaId) => areaDef(id).name;

export type Snapshot = Record<AreaId, { minions: Record<PlayerID, number>; trouble: boolean }>;

export function snapshot(G: AMState): Snapshot {
  return Object.fromEntries(AREA_IDS.map((id) => [id, { minions: { ...G.areas[id].minions }, trouble: G.areas[id].trouble }]));
}

/** Какие карты помогают от потери. */
function cardsFor(source: Offer['source'], loss: Loss): string[] {
  const removed = loss.to == null;
  if (source === 'event') return removed ? [SUSAN, ...RELOCATE] : [];
  if (source === 'assassinate') return [GASPODE, SUSAN, ...(removed ? RELOCATE : [])];
  if (source === 'scroll') return [...PREVENT, ...(removed ? RELOCATE : [])];
  return [];
}

function lossText(l: Loss): string {
  return l.to == null ? `слуга в районе ${areaName(l.area)}` : `слуга, уведённый: ${areaName(l.area)} → ${areaName(l.to)}`;
}

/** Пересчитать варианты; false — предлагать нечего. */
function refresh(G: AMState, o: Offer): boolean {
  if (o.source === 'target') return true;
  const hand = G.players[o.player].hand;
  o.options = [];
  o.labels = {};
  o.losses.forEach((l, i) => {
    for (const c of cardsFor(o.source, l)) {
      if (!hand.includes(c)) continue;
      const key = `${c}@${i}`;
      o.options.push(key);
      o.labels[key] = `${cardName(c)}: ${RELOCATE.includes(c) ? 'переставить' : 'спасти'} — ${lossText(l)}`;
    }
  });
  if (o.options.length === 0) return false;
  o.options.push('none');
  o.labels.none = 'Не играть';
  return true;
}

/** Сравнить поле со снимком и предложить прерывания пострадавшим. */
export function offerLosses(G: AMState, snap: Snapshot, source: 'assassinate' | 'scroll' | 'event', current: PlayerID): void {
  for (const pid of Object.keys(G.players)) {
    if (source !== 'event' && pid === current) continue;
    const lost: AreaId[] = [];
    const gained: AreaId[] = [];
    for (const id of AREA_IDS) {
      const d = G.areas[id].minions[pid] - snap[id].minions[pid];
      for (let i = 0; i < -d; i++) lost.push(id);
      for (let i = 0; i < d; i++) gained.push(id);
    }
    if (lost.length === 0) continue;
    const losses: Loss[] = lost.map((area) => {
      const to = gained.shift();
      return to == null
        ? { area, trouble: snap[area].trouble }
        : { area, to, trouble: snap[area].trouble, troubleTo: snap[to].trouble };
    });
    const o: Offer = { player: pid, source, losses, options: [], labels: {} };
    if (refresh(G, o)) G.offers.push(o);
  }
}

/** Сонки: игрока выбрали целью текста карты. Возвращает true, если ответ отложен до решения игрока. */
export function offerTarget(G: AMState, target: PlayerID, choice: string): boolean {
  if (!hasCard(G, target, SONKY)) return false;
  G.offers.push({
    player: target, source: 'target', losses: [], choice,
    options: [SONKY, 'none'],
    labels: { [SONKY]: `${cardName(SONKY)}: текст карты вас не касается`, none: 'Не играть' },
  });
  return true;
}

function discardFromHand(G: AMState, pid: PlayerID, card: string): void {
  const hand = G.players[pid].hand;
  hand.splice(hand.indexOf(card), 1);
  G.discard.push(card);
}

/** Ход «ответ на прерывание». api.pid — текущий игрок; responder — пострадавший. */
export function answerOffer(api: EffectApi, responder: PlayerID, choice: string | number): string | null {
  const { G } = api;
  const o = G.offers[0];
  if (!o) return 'Нет предложения';
  if (o.player !== responder) return 'Сейчас решает другой игрок';
  const who = nameOf(G, responder);

  if (o.relocate) {
    const area = Number(choice);
    if (!o.relocate.options.includes(area)) return 'Сюда нельзя';
    const p = G.players[responder];
    p.minionSupply--;
    troubleEnter(G.areas[area]);
    G.areas[area].minions[responder]++;
    log(G, `${who}: «${cardName(o.relocate.card)}» — слуга встаёт в район ${areaName(area)}`);
    o.relocate = undefined;
    if (!refresh(G, o)) G.offers.shift();
    return null;
  }

  const key = String(choice);
  if (!o.options.includes(key)) return 'Такой вариант недоступен';

  if (o.source === 'target') {
    G.offers.shift();
    if (key === 'none') return answerPrompt(api, G.prompt!.actor, o.choice!, { noSonky: true });
    discardFromHand(G, responder, SONKY);
    log(G, `${who}: «${cardName(SONKY)}» — текст карты его не касается`);
    G.prompt = null;
    if (G.play) advanceSymbol(G);
    return null;
  }

  if (key === 'none') {
    G.offers.shift();
    return null;
  }
  const [card, idx] = key.split('@');
  const l = o.losses[Number(idx)];
  discardFromHand(G, responder, card);
  o.losses.splice(Number(idx), 1);
  if (RELOCATE.includes(card)) {
    o.relocate = { card, area: l.area, options: AREA_IDS.filter((a) => a !== l.area) };
    o.options = o.relocate.options.map(String);
    o.labels = Object.fromEntries(o.relocate.options.map((a) => [String(a), areaName(a)]));
    return null;
  }
  // Гаспод, Сьюзан, Сонки: слуга остаётся на месте.
  const from = G.areas[l.area];
  if (l.to != null) {
    G.areas[l.to].minions[responder]--;
    G.areas[l.to].trouble = !!l.troubleTo;
  } else {
    G.players[responder].minionSupply--;
  }
  from.minions[responder]++;
  from.trouble = l.trouble;
  log(G, `${who}: «${cardName(card)}» — ${lossText(l)} остаётся на месте`);
  if (!refresh(G, o)) G.offers.shift();
  return null;
}

/** Любую карту-прерывание можно сбросить в любой момент (эффект — вручную). */
export function playInterrupt(G: AMState, pid: PlayerID, card: string): string | null {
  if (!hasCard(G, pid, card) || !isInterrupt(card)) return 'Нет такой карты-прерывания';
  discardFromHand(G, pid, card);
  log(G, `${nameOf(G, pid)} играет прерывание «${cardName(card)}» — выполните эффект вручную (✋)`);
  return null;
}

/** Доктор Мосси Лаун: сыгранная карта возвращается в руку, ход окончен (добор — снаружи). */
export function mossyLawn(G: AMState, pid: PlayerID): string | null {
  const p = G.players[pid];
  if (!hasCard(G, pid, MOSSY)) return 'Нет карты';
  if (G.prompt || G.offers.length) return 'Сначала ответьте на вопрос';
  let back: string;
  if (G.play) {
    back = G.play.cardId;
    G.play = null;
  } else if (G.lastPlayed && G.discard[G.discard.length - 1] === G.lastPlayed) {
    back = G.discard.pop()!;
  } else return 'Нет сыгранной карты, которую можно вернуть';
  discardFromHand(G, pid, MOSSY);
  p.hand.push(back);
  log(G, `${nameOf(G, pid)}: «${cardName(MOSSY)}» — «${cardName(back)}» возвращается в руку, ход окончен`);
  return null;
}
