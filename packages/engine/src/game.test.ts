import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import type { Game } from 'boardgame.io';
import { AnkhMorporkGame } from './game';
import { playerView, HIDDEN_CARD } from './view';
import type { AMState } from './types';
import { COLORS } from './types';
import { currentSymbol } from './turn';
import { assassinationAreas, assassinationTargets, buildableAreas, legalMinionAreas, troubleAreas } from './rules';
import { AREA_IDS } from './data/areas';

const testGame: Game<AMState> = { ...AnkhMorporkGame, playerView: undefined };

function started(numPlayers: number, game: Game<AMState> = testGame) {
  const client = Client<AMState>({ game, numPlayers });
  client.start();
  COLORS.slice(0, numPlayers).forEach((c, i) => client.moves.setColor(c, String(i)));
  client.moves.startGame();
  return client;
}

/** Игра, где у каждого игрока первая карта в руке — Ринсвинд (событие, свиток, ещё карта). */
const withRincewind: Game<AMState> = {
  ...testGame,
  setup: (args) => {
    const G = AnkhMorporkGame.setup!(args as never);
    for (const p of Object.values(G.players)) p.hand[0] = 'rincewind';
    return G;
  },
};

describe('лобби', () => {
  it('без цветов старт невозможен; после старта — фаза play', () => {
    const client = Client<AMState>({ game: testGame, numPlayers: 2 });
    client.start();
    client.moves.startGame();
    expect(client.getState()!.ctx.phase).toBe('lobby');
    client.moves.setColor('red', '0');
    client.moves.setColor('blue', '1');
    client.moves.startGame();
    const { G, ctx } = client.getState()!;
    expect(ctx.phase).toBe('play');
    expect(G.started).toBe(true);
    expect(G.playsLeft).toBe(1);
  });
});

describe('скрытая информация', () => {
  it('чужие руки и личности скрыты, колоды — только размер', () => {
    const client = started(3);
    const G = client.getState()!.G;
    const v = playerView({ G, playerID: '1' });
    expect(v.players['1'].hand).toEqual(G.players['1'].hand);
    expect(v.players['1'].personality).toBe(G.players['1'].personality);
    expect(v.players['0'].hand.every((c) => c === HIDDEN_CARD)).toBe(true);
    expect(v.players['0'].hand).toHaveLength(5);
    expect(v.players['0'].personality).toBeNull();
    expect(v.deck).toEqual([]);
    expect(v.deckCount).toBe(G.deck.length);
    expect(v.events).toEqual([]);
    expect(v.eventsCount).toBe(12);
  });
});

describe('отмена', () => {
  it('сыгранную карту можно отменить', () => {
    const client = started(2);
    const { G, ctx } = client.getState()!;
    const card = G.players[ctx.currentPlayer].hand[1];
    client.moves.playCard(card);
    expect(client.getState()!.G.play).not.toBeNull();
    client.undo();
    const after = client.getState()!.G;
    expect(after.play).toBeNull();
    expect(after.players[ctx.currentPlayer].hand).toContain(card);
  });

  it('вытянутое событие отменить нельзя', () => {
    const client = started(2, withRincewind);
    client.moves.playCard('rincewind');
    client.moves.drawEvent();
    const ev = client.getState()!.G.lastEvent;
    expect(ev).not.toBeNull();
    client.undo();
    expect(client.getState()!.G.lastEvent).toBe(ev);
  });
});

describe('победа в начале хода', () => {
  it('Дракон при 8 беспорядках выигрывает в начале своего хода', () => {
    const dragon: Game<AMState> = {
      ...testGame,
      setup: (args) => {
        const G = AnkhMorporkGame.setup!(args as never);
        for (const p of Object.values(G.players)) p.personality = 'dragon-king-of-arms';
        for (const id of AREA_IDS.slice(0, 8)) G.areas[id].trouble = true;
        return G;
      },
    };
    const client = started(2, dragon);
    const { ctx } = client.getState()!;
    expect(ctx.gameover).toMatchObject({ winner: ctx.currentPlayer, reason: 'personality' });
  });
});

/** Детерминированный генератор для автопартий. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function autoplay(numPlayers: number, seed: number) {
  const client = started(numPlayers, { ...testGame, seed: `seed-${seed}` });
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  for (let step = 0; step < 20000; step++) {
    const { G, ctx } = client.getState()!;
    if (ctx.gameover) return ctx.gameover;
    const pid = ctx.currentPlayer;
    const p = G.players[pid];
    if (!G.play) {
      if (G.playsLeft > 0 && p.hand.length > 0 && (G.cardsPlayed === 0 || r() < 0.5)) client.moves.playCard(pick(p.hand));
      else client.moves.finishTurn();
      continue;
    }
    const sym = currentSymbol(G)!;
    switch (sym.kind) {
      case 'minion': {
        const t = legalMinionAreas(G, pid);
        if (p.minionSupply > 0 && t.length) client.moves.placeMinion(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'building': {
        const t = buildableAreas(G, pid);
        if (p.buildingSupply > 0 && t.length) client.moves.build(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'assassinate': {
        const t = assassinationAreas(G, pid);
        if (t.length) {
          const area = pick(t);
          client.moves.assassinate(area, assassinationTargets(G, pid, area)[0]);
        } else client.moves.skipSymbol();
        break;
      }
      case 'removeTrouble': {
        const t = troubleAreas(G);
        if (t.length) client.moves.removeTrouble(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'money': client.moves.takeMoney(); break;
      case 'playAnother': client.moves.playAnother(); break;
      case 'event': client.moves.drawEvent(); break;
      default: client.moves.skipSymbol();
    }
  }
  throw new Error('Партия не закончилась за 20000 шагов (какой-то ход отклоняется)');
}

describe('автопартии до конца', () => {
  for (const n of [2, 3, 4]) {
    for (const seed of [1, 2, 3]) {
      it(`${n} игрока, seed ${seed}`, () => {
        const over = autoplay(n, seed);
        expect(['personality', 'vimes', 'score']).toContain(over.reason);
        expect(over.winner).not.toBeNull();
      });
    }
  }
});
