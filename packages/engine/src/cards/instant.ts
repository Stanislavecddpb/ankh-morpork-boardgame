import type { AMState } from '../types';
import { AREA_IDS } from '../data/areas';
import { drawCards, nameOf } from '../helpers';
import { troubleCount } from '../rules';
import { defineEffects, type Effect } from './run';
import { pay, say } from './ops';

const draw = (n: number | ((G: AMState, pid: string) => number)): Effect => ({
  start(api) {
    api.lock();
    const want = typeof n === 'number' ? n : n(api.G, api.pid);
    say(api, `берёт карт: ${drawCards(api.G, api.pid, want)}`);
    return null;
  },
});

const gain = (count: (G: AMState) => number, what: string): Effect => ({
  start(api) {
    const n = count(api.G);
    api.G.players[api.pid].money += n;
    say(api, `+$${n} (${what})`);
    return null;
  },
});

const fromEach = (n: number): Effect => ({
  start(api) {
    for (const o of api.others) say(api, `берёт $${pay(api.G, o, api.pid, n)} у игрока ${nameOf(api.G, o)}`);
    return null;
  },
});

const loan: Effect = {
  start(api) {
    const p = api.G.players[api.pid];
    p.money += 10;
    p.loans++;
    api.G.play!.toFront = api.pid;
    say(api, 'берёт займ $10 (в конце вернуть $12 или −15 очков)');
    return null;
  },
};

const playTwo: Effect = {
  start(api) {
    api.G.playsLeft += 2;
    say(api, 'может сыграть ещё две карты');
    return null;
  },
};

const buildings = (G: AMState) => AREA_IDS.filter((id) => G.areas[id].building).length;
const isleMinions = (G: AMState) => Object.values(G.areas[10].minions).reduce((s, n) => s + n, 0);

defineEffects({
  'leonard-of-quirm': draw(4),
  librarian: draw(4),
  hex: draw(3),
  'sgt-cheery-littlebottom': draw(2),
  'clack-towers': draw(2),
  'lecturer-in-recent-runes': draw(2),
  'moist-von-lipwig': draw(2),
  gargoyles: draw((G, pid) => AREA_IDS.filter((id) => G.areas[id].building === pid).length),
  'sacharissa-cripslock': gain(troubleCount, 'беспорядки на поле'),
  'otto-chriek': gain(troubleCount, 'беспорядки на поле'),
  'william-de-worde': gain(troubleCount, 'беспорядки на поле'),
  'post-office': gain(buildings, 'здания на поле'),
  'sir-charles-lavatory': gain(buildings, 'здания на поле'),
  dysk: gain(isleMinions, 'слуги на Острове Богов'),
  'opera-house': gain(isleMinions, 'слуги на Острове Богов'),
  'mr-boggis': fromEach(2),
  'thieves-guild': fromEach(2),
  'the-bank-of-ankh-morpork': loan,
  'mr-bent': loan,
  drumknott: playTwo,
  'ponder-stibbons': playTwo,
  'history-monks': {
    start(api) {
      api.lock();
      const pile = api.rnd.shuffle(api.G.discard);
      const take = pile.splice(0, 4);
      api.G.discard = pile;
      api.G.players[api.pid].hand.push(...take);
      say(api, `берёт из сброса карт: ${take.length}`);
      return null;
    },
  },
});
