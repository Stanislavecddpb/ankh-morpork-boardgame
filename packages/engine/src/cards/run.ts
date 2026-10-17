import type { AMState, Choice, PlayerID, Prompt } from '../types';
import { advanceSymbol, currentSymbol } from '../turn';

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
}

export type PromptSpec = Omit<Prompt, 'cardId' | 'data'> & { data?: Record<string, any> };
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
    others: [...order.slice(i + 1), ...order.slice(0, i)],
    locked: false,
    lock() { api.locked = true; },
  };
  return api;
}

function settle(api: EffectApi, next: Next | string): string | null {
  if (typeof next === 'string') return next;
  const { G } = api;
  if (next) {
    G.prompt = { ...next, data: next.data ?? {}, cardId: G.play!.cardId };
    if (next.locked) api.lock();
  } else {
    G.prompt = null;
    advanceSymbol(G);
  }
  return null;
}

export function startScroll(api: EffectApi): string | null {
  const { G } = api;
  if (!G.play || currentSymbol(G)?.kind !== 'scroll') return 'Сейчас не текст карты';
  if (G.prompt) return 'Текст карты уже разыгрывается';
  const eff = effectFor(G.play.cardId);
  if (!eff) return 'Эта карта разыгрывается вручную';
  return settle(api, eff.start(api));
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
export function answerPrompt(api: EffectApi, responder: PlayerID, choice: Choice): string | null {
  const p = api.G.prompt;
  if (!p) return 'Нет вопроса';
  if (p.actor !== responder) return 'Сейчас отвечает другой игрок';
  const err = validate(api.G, p, choice);
  if (err) return err;
  const eff = effectFor(p.cardId);
  if (!eff?.answer) return 'Эффект не ждёт ответа';
  return settle(api, eff.answer(api, p, choice));
}
