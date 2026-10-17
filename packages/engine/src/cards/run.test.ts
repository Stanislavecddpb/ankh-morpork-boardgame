import { describe, it, expect, afterEach } from 'vitest';
import { defineEffects, effectFor } from './run';
import { ask, say } from './ops';
import { scenario } from './testkit';
import { playerView } from '../view';
import { CARDS } from '../data/cards';
import { hasEffect } from './run';
import './index';

// Тестовый эффект подменяет настоящий эффект Драмнотта (только свиток) и возвращает его после теста.
const TEST = 'drumknott';
const saved = effectFor(TEST);
afterEach(() => { defineEffects({ [TEST]: saved as never }); });

describe('реестр', () => {
  it('у каждой карты со свитком есть эффект', () => {
    const missing = CARDS.filter((c) => c.symbols.some((s) => s.kind === 'scroll') && !hasEffect(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });
});

describe('исполнитель свитков', () => {
  it('вопрос → ответ → карта уходит в сброс', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 's', kind: 'player', options: api.others, text: 'Кого?' }),
        answer: (api, _p, c) => { api.G.players[api.pid].money += 1; say(api, `выбран ${c}`); return null; },
      },
    });
    const s = scenario(TEST);
    expect(s.start()).toBeNull();
    expect(s.prompt()).toMatchObject({ actor: '0', kind: 'player', options: ['1', '2'] });
    expect(s.answer('1', '1')).not.toBeNull(); // отвечает не тот
    expect(s.answer('0', '9')).not.toBeNull(); // нет такого варианта
    expect(s.answer('0', '2')).toBeNull();
    expect(s.G.prompt).toBeNull();
    expect(s.G.play).toBeNull();
    expect(s.G.discard).toContain(TEST);
    expect(s.G.players['0'].money).toBe(11);
  });

  it('выбор карт из руки: количество проверяется', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 'h', kind: 'hand', options: [], min: 1, max: 2, text: 'Сбросьте', actor: '1' }),
        answer: () => null,
      },
    });
    const s = scenario(TEST);
    s.start();
    const hand = s.G.players['1'].hand;
    expect(s.answer('1', [])).not.toBeNull();
    expect(s.answer('1', hand.slice(0, 3))).not.toBeNull();
    expect(s.answer('1', ['чужая'])).not.toBeNull();
    expect(s.answer('1', hand.slice(0, 2))).toBeNull();
  });

  it('скрытое в вопросе видит только отвечающий', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 'r', kind: 'reveal', options: ['a', 'b'], reveal: ['a', 'b'], text: 'Смотрите', locked: true }),
        answer: () => null,
      },
    });
    const s = scenario(TEST);
    s.start();
    expect(playerView({ G: s.G, playerID: '0' }).prompt?.reveal).toEqual(['a', 'b']);
    const other = playerView({ G: s.G, playerID: '1' }).prompt!;
    expect(other.reveal).toBeUndefined();
    expect(other.options).toEqual([]);
  });

  it('нет вариантов — часть эффекта пропущена, свиток завершён', () => {
    defineEffects({ [TEST]: { start: (api) => ask(api, { step: 'x', kind: 'area', options: [], text: '' }) } });
    const s = scenario(TEST);
    expect(s.start()).toBeNull();
    expect(s.G.play).toBeNull();
  });
});
