import type { AMState, AreaId, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { nameOf } from '../helpers';
import { troubleAreas } from '../rules';
import { defineEffects, type Effect, type EffectApi } from './run';
import {
  ask, isMinionLike, moveMinion, parsePiece, pay, pieceName, pieces, putMinion, removePiece, say, type PieceRef,
} from './ops';

const UNREAL = 2;
const unrealOrAdjacent = () => [UNREAL, ...areaDef(UNREAL).adjacent];
const minionKeys = (G: AMState, f: (p: PieceRef) => boolean) => pieces(G, (p) => p.kind === 'minion' && f(p));

/** Переместить слугу: сначала фишка, потом район-цель. */
function moveEffect(o: {
  which: (G: AMState, pid: PlayerID) => string[];
  targets: (G: AMState, from: AreaId) => AreaId[];
  text: string;
}): Effect {
  return {
    start: (api) => ask(api, { step: 'piece', kind: 'piece', options: o.which(api.G, api.pid), text: o.text }),
    answer(api, p, c) {
      if (p.step === 'piece') {
        const from = parsePiece(c as string).area;
        return ask(api, { step: 'to', kind: 'area', options: o.targets(api.G, from), text: 'Куда переместить?', data: { piece: c } });
      }
      const pc = parsePiece(p.data.piece);
      moveMinion(api.G, pc.owner!, pc.area, c as number);
      say(api, `${pieceName(api.G, pc)} → ${areaDef(c as number).name}`);
      return null;
    },
  };
}

const otherAdjacent = moveEffect({
  which: (G, pid) => minionKeys(G, (p) => p.owner !== pid),
  targets: (_G, from) => areaDef(from).adjacent,
  text: 'Выберите слугу другого игрока — он переместится в соседний район',
});
const ownAnywhere = moveEffect({
  which: (G, pid) => minionKeys(G, (p) => p.owner === pid),
  targets: (_G, from) => AREA_IDS.filter((id) => id !== from),
  text: 'Выберите своего слугу для перемещения в любой район',
});

/** Поставить слугу в район из списка; times — сколько раз (Ридкулли — 2). */
function placeEffect(text: string, areas: (G: AMState, pid: PlayerID) => AreaId[], trouble: boolean, times = 1): Effect {
  const prompt = (api: EffectApi, left: number) => {
    if (api.G.players[api.pid].minionSupply < 1) { say(api, 'нет слуг в запасе'); return null; }
    return ask(api, { step: 'place', kind: 'area', options: areas(api.G, api.pid), text, data: { left } });
  };
  return {
    start: (api) => prompt(api, times),
    answer(api, p, c) {
      putMinion(api.G, api.pid, c as number, trouble);
      say(api, `ставит слугу: ${areaDef(c as number).name}${trouble ? '' : ' (без беспорядка)'}`);
      return p.data.left > 1 ? prompt(api, p.data.left - 1) : null;
    },
  };
}

/** Положить беспорядок в район из списка. */
function troubleEffect(text: string, areas: (G: AMState) => AreaId[]): Effect {
  return {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: areas(api.G), text }),
    answer(api, _p, c) {
      api.G.areas[c as number].trouble = true;
      say(api, `кладёт беспорядок: ${areaDef(c as number).name}`);
      return null;
    },
  };
}

/** Заменить чужое здание своим с компенсацией владельцу (Сибилла — без беспорядка, Позолот — с ним). */
function replaceBuilding(withTrouble: boolean): Effect {
  return {
    start(api) {
      const me = api.G.players[api.pid];
      const opts = me.buildingSupply < 1 ? [] : pieces(api.G, (p) =>
        p.kind === 'building' && p.owner !== api.pid && api.G.areas[p.area].trouble === withTrouble
        && me.money >= areaDef(p.area).cost);
      return ask(api, { step: 'b', kind: 'piece', options: opts, text: 'Выберите чужое здание для замены своим' });
    },
    answer(api, _p, c) {
      const pc = parsePiece(c as string);
      const cost = areaDef(pc.area).cost;
      pay(api.G, api.pid, pc.owner!, cost);
      api.G.players[pc.owner!].buildingSupply++;
      api.G.players[api.pid].buildingSupply--;
      api.G.areas[pc.area].building = api.pid;
      say(api, `заменяет ${pieceName(api.G, pc)} своим зданием, платит владельцу $${cost}`);
      return null;
    },
  };
}

/** Заплатить выбранному игроку $2, затем продолжить другим эффектом. */
function payThen(next: Effect): Effect {
  return {
    start(api) {
      if (api.G.players[api.pid].money < 2) { say(api, 'не хватает $2'); return null; }
      return ask(api, { step: 'payee', kind: 'player', options: api.others, text: 'Кому заплатить $2?' });
    },
    answer(api, p, c) {
      if (p.step === 'payee') {
        pay(api.G, api.pid, c as string, 2);
        say(api, `платит $2 игроку ${nameOf(api.G, c as string)}`);
        return next.start(api);
      }
      return next.answer!(api, p, c);
    },
  };
}

const removeAny: Effect = {
  start: (api) => ask(api, { step: 'victim', kind: 'piece', options: pieces(api.G, isMinionLike), text: 'Выберите фишку, которую убрать' }),
  answer(api, _p, c) {
    const pc = parsePiece(c as string);
    removePiece(api.G, pc);
    say(api, `убирает: ${pieceName(api.G, pc)}`);
    return null;
  },
};

defineEffects({
  duckman: otherAdjacent,
  'foul-ole-ron': otherAdjacent,
  'canting-crew': otherAdjacent,
  rincewind: moveEffect({
    which: (G, pid) => minionKeys(G, (p) => p.owner === pid && G.areas[p.area].trouble),
    targets: (_G, from) => areaDef(from).adjacent,
    text: 'Выберите своего слугу из района с беспорядком — он уйдёт в соседний',
  }),
  dorfl: ownAnywhere,
  'adora-belle-dearheart': ownAnywhere,
  'hobson-livery-stables': payThen(ownAnywhere),
  'mr-shine': placeEffect('Куда поставить слугу (без беспорядка)?', () => AREA_IDS, false),
  'deep-dwarves': placeEffect('Куда поставить слугу (без беспорядка)?', () => AREA_IDS, false),
  willikins: placeEffect('Куда поставить слугу (район с вашим зданием)?',
    (G, pid) => AREA_IDS.filter((id) => G.areas[id].building === pid), true),
  'smoking-gnu': placeEffect('Куда поставить слугу (район с беспорядком)?', (G) => troubleAreas(G), true),
  'archchancellor-ridcully': placeEffect('Куда поставить слугу (Внедвижимость или соседний)? Второй — по желанию', unrealOrAdjacent, true, 2),
  'senior-wrangler': placeEffect('Куда поставить слугу (Внедвижимость или соседний)?', unrealOrAdjacent, true),
  'dean-of-pentacles': {
    start: (api) => ask(api, { step: 'victim', kind: 'piece', options: minionKeys(api.G, (p) => p.area === UNREAL), text: 'Какого слугу убрать из Внедвижимости?' }),
    answer: removeAny.answer,
  },
  'dr-hicks': troubleEffect('Куда положить беспорядок?', (G) => AREA_IDS.filter((id) => !G.areas[id].trouble)),
  'the-mob': troubleEffect('Куда положить беспорядок (рядом с районом, где он уже есть)?', (G) =>
    AREA_IDS.filter((id) => !G.areas[id].trouble && areaDef(id).adjacent.some((n) => G.areas[n].trouble))),
  bursar: {
    start: (api) => ask(api, { step: 'a', kind: 'piece', options: minionKeys(api.G, () => true), text: 'Первый слуга для обмена местами' }),
    answer(api, p, c) {
      if (p.step === 'a') {
        const area = parsePiece(c as string).area;
        return ask(api, { step: 'b', kind: 'piece', options: minionKeys(api.G, (x) => x.area !== area), text: 'Второй слуга (в другом районе)', data: { a: c } });
      }
      const a = parsePiece(p.data.a);
      const b = parsePiece(c as string);
      // По FAQ: оба снимаются, затем ставятся на места друг друга с проверкой беспорядков.
      api.G.areas[a.area].minions[a.owner!]--;
      api.G.areas[a.area].trouble = false;
      api.G.areas[b.area].minions[b.owner!]--;
      api.G.areas[b.area].trouble = false;
      api.G.players[a.owner!].minionSupply++;
      api.G.players[b.owner!].minionSupply++;
      putMinion(api.G, a.owner!, b.area);
      putMinion(api.G, b.owner!, a.area);
      say(api, `меняет местами: ${pieceName(api.G, a)} ↔ ${pieceName(api.G, b)}`);
      return null;
    },
  },
  'mr-slant': {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: troubleAreas(api.G), text: 'Выберите район с беспорядком: $2 за каждого слугу в нём' }),
    answer(api, _p, c) {
      const n = Object.values(api.G.areas[c as number].minions).reduce((s, x) => s + x, 0);
      api.G.players[api.pid].money += 2 * n;
      say(api, `+$${2 * n} (${areaDef(c as number).name})`);
      return null;
    },
  },
  'wee-mad-arthur': {
    start(api) {
      const me = api.G.players[api.pid];
      const opts = me.buildingSupply < 1 ? [] : AREA_IDS.filter((id) => {
        const a = api.G.areas[id];
        return a.minions[api.pid] > 0 && !a.trouble && a.building === null && me.money >= Math.ceil(areaDef(id).cost / 2);
      });
      return ask(api, { step: 'area', kind: 'area', options: opts, text: 'Где построить здание за полцены?' });
    },
    answer(api, _p, c) {
      const cost = Math.ceil(areaDef(c as number).cost / 2);
      api.G.players[api.pid].money -= cost;
      api.G.players[api.pid].buildingSupply--;
      api.G.areas[c as number].building = api.pid;
      say(api, `строит здание за $${cost}: ${areaDef(c as number).name}`);
      return null;
    },
  },
  'sybil-vimes': replaceBuilding(false),
  'reacher-gilt': replaceBuilding(true),
  'burleigh-and-stronginthearm': payThen(removeAny),
});
