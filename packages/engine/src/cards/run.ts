import type { AMState, Choice, PlayerID, Prompt, PromptOrigin } from '../types';
import { advanceSymbol, currentSymbol } from '../turn';
import { CARD_BY_ID, EVENT_BY_ID } from '../data/cards';
import { areaDef } from '../data/areas';
import { LOSS_EVENTS, MASS_CARDS, offerLosses, offerMass, offerTarget, snapshot } from './interrupts';

export interface Rnd {
  d12(): number;
  shuffle<T>(arr: T[]): T[];
}

export interface EffectApi {
  G: AMState;
  pid: PlayerID;
  rnd: Rnd;
  /** Остальные игроки в порядке хода, начиная со следующего. */
  others: PlayerID[];
  /** Ход открыл скрытое или случайное: его нельзя отменить. */
  locked: boolean;
  lock(): void;
  /** Название источника эффекта для лога (карта, район, событие). */
  title?: string;
}

export type PromptSpec = Omit<Prompt, 'cardId' | 'data' | 'origin'> & { data?: Record<string, any> };
export type Next = PromptSpec | null;

/** Сценарий свитка: start — первый вопрос (или null — уже выполнено); answer — следующий. */
export interface Effect {
  start(api: EffectApi): Next | string;
  answer?(api: EffectApi, p: Prompt, choice: Choice): Next | string;
}

const REGISTRY: Record<string, Effect> = {};

export function defineEffects(map: Record<string, Effect>): void {
  Object.assign(REGISTRY, map);
}
export const effectFor = (cardId: string): Effect | undefined => REGISTRY[cardId];
export const hasEffect = (cardId: string): boolean => !!REGISTRY[cardId];

export function makeApi(G: AMState, pid: PlayerID, order: PlayerID[], rnd: Rnd): EffectApi {
  const i = order.indexOf(pid);
  const api: EffectApi = {
    G, pid, rnd,
    // Сыгравшие Сонки против текущего текста карты в «остальных игроках» не участвуют.
    others: [...order.slice(i + 1), ...order.slice(0, i)].filter((o) => !G.immune?.includes(o)),
    locked: false,
    lock() { api.locked = true; },
  };
  return api;
}

/** Название источника по ключу эффекта. */
export function effectTitle(key: string): string {
  if (key.startsWith('district:')) return areaDef(Number(key.slice(9))).name;
  if (key.startsWith('event:')) return EVENT_BY_ID[key.slice(6)]?.name ?? key;
  return CARD_BY_ID[key]?.name ?? key;
}

/** Запуск эффекта по ключу: вопрос сохраняется в G.prompt, по окончании карта идёт дальше (кроме района). */
export function runEffect(api: EffectApi, key: string, origin: PromptOrigin, step: (eff: Effect) => Next | string): string | null {
  const eff = effectFor(key);
  if (!eff) return 'Эффект разыгрывается вручную';
  api.title = effectTitle(key);
  // Чужие слуги до и после шага: потери — повод предложить прерывание.
  const snap = snapshot(api.G);
  const err = settle(api, step(eff), key, origin);
  if (!err && (origin === 'scroll' || LOSS_EVENTS.includes(key))) offerLosses(api.G, snap, origin === 'scroll' ? 'scroll' : 'event', api.pid);
  return err;
}

function settle(api: EffectApi, next: Next | string, key: string, origin: PromptOrigin): string | null {
  if (typeof next === 'string') return next;
  const { G } = api;
  if (next) {
    G.prompt = { ...next, data: next.data ?? {}, cardId: key, origin };
    if (next.locked) api.lock();
  } else {
    G.prompt = null;
    if (origin === 'scroll') G.immune = [];
    if (origin !== 'district' && G.play) advanceSymbol(G);
  }
  return null;
}

export function startScroll(api: EffectApi): string | null {
  const { G } = api;
  if (!G.play || currentSymbol(G)?.kind !== 'scroll') return 'Сейчас не текст карты';
  if (G.prompt) return 'Текст карты уже разыгрывается';
  if (!effectFor(G.play.cardId)) return 'Эта карта разыгрывается вручную';
  if (G.offers.length) return 'Ждём ответа на прерывание';
  // Текст касается всех остальных: сначала спросить владельцев Сонки (эффект запустится после ответов).
  if (MASS_CARDS.includes(G.play.cardId) && offerMass(G, api.others)) { api.lock(); return null; }
  return runEffect(api, G.play.cardId, 'scroll', (eff) => eff.start(api));
}

function validate(G: AMState, p: Prompt, c: Choice): string | null {
  if (p.kind === 'hand') {
    if (!Array.isArray(c)) return 'Нужен список карт';
    const hand = G.players[p.actor].hand;
    if (new Set(c).size !== c.length || c.some((x) => !hand.includes(x))) return 'Таких карт нет в руке';
    if (c.length < (p.min ?? 0) || c.length > (p.max ?? hand.length)) return 'Не то количество карт';
    return null;
  }
  return p.options.includes(c as string | number) ? null : 'Такой вариант недоступен';
}

/** Ответ на вопрос. api.pid — тот, кто разыгрывает карту; responder — кто отвечает (может быть соперник). */
export function answerPrompt(api: EffectApi, responder: PlayerID, choice: Choice, opts: { noSonky?: boolean } = {}): string | null {
  const p = api.G.prompt;
  if (!p) return 'Нет вопроса';
  if (api.G.offers.length) return 'Ждём ответа на прерывание';
  if (p.actor !== responder) return 'Сейчас отвечает другой игрок';
  const err = validate(api.G, p, choice);
  if (err) return err;
  if (!effectFor(p.cardId)?.answer) return 'Эффект не ждёт ответа';
  // Уоллис Сонки: выбранный целью текста чужой карты может отказаться от эффекта.
  if (!opts.noSonky && p.origin === 'scroll' && p.kind === 'player' && choice !== api.pid && offerTarget(api.G, String(choice), String(choice))) return null;
  return runEffect(api, p.cardId, p.origin, (eff) => eff.answer!(api, p, choice));
}
