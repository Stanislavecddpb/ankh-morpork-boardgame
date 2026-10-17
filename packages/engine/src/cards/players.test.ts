import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 3: выбор игрока', () => {
  it('нобби ноббс: $3 у выбранного', () => {
    const s = scenario('nobby-nobbs');
    s.start();
    expect(s.prompt()).toMatchObject({ kind: 'player', options: ['1', '2'] });
    s.answer('0', '2');
    expect([s.G.players['0'].money, s.G.players['2'].money]).toEqual([13, 7]);
  });

  it('хьюберт: A платит B $3, себя выбрать нельзя', () => {
    const s = scenario('hubert', { players: 4 });
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.options).toEqual(['2', '3']);
    s.answer('0', '3');
    expect([s.G.players['1'].money, s.G.players['3'].money]).toEqual([7, 13]);
  });

  it('заведующий кафедрой: обмен руками', () => {
    const s = scenario('chair-of-indefinite-studies', { setup: (G) => { G.players['0'].hand.push('x'); } });
    const theirs = [...s.G.players['1'].hand];
    s.start();
    s.answer('0', '1');
    expect(s.G.players['0'].hand).toEqual(theirs);
    expect(s.G.players['1'].hand).toEqual(['x']);
  });

  it('особисты: посмотреть руку и сбросить карту', () => {
    const s = scenario('cable-street-particulars');
    const theirs = [...s.G.players['2'].hand];
    s.start();
    s.answer('0', '2');
    expect(s.prompt()).toMatchObject({ kind: 'reveal', reveal: theirs, options: theirs, locked: true });
    s.answer('0', theirs[1]);
    expect(s.G.players['2'].hand).not.toContain(theirs[1]);
    expect(s.G.discard).toContain(theirs[1]);
  });

  it('стэнли: две случайные, одну оставить', () => {
    const s = scenario('stanley');
    const [a, b] = s.G.players['1'].hand;
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.options).toEqual([a, b]);
    s.answer('0', b);
    expect(s.G.players['0'].hand).toEqual([b]);
    expect(s.G.players['1'].hand).toContain(a);
    expect(s.G.players['1'].hand).toHaveLength(4);
  });

  it('миссис кейк: все неиспользованные личности, кроме одной', () => {
    const s = scenario('mrs-cake');
    s.start();
    const p = s.prompt()!;
    expect(p.kind).toBe('reveal');
    expect(p.reveal).toHaveLength(s.G.spare.length - 1);
    expect(s.answer('0', 'ok')).toBeNull();
  });

  it('зорго: заменить личность или оставить', () => {
    const s = scenario('zorgo-the-retrophrenologist');
    const before = s.G.players['0'].personality;
    s.start();
    s.answer('0', 'swap');
    expect(s.G.players['0'].personality).not.toBe(before);
    expect(s.G.spare).toContain(before);
  });
});
