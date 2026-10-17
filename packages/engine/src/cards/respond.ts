import type { PlayerID } from '../types';
import { CARD_BY_ID } from '../data/cards';
import { nameOf } from '../helpers';
import { defineEffects, type Effect, type EffectApi, type Next } from './run';
import { ask, isMinionLike, moveCards, parsePiece, pay, pieceName, pieces, removePiece, say } from './ops';

const played = (api: EffectApi) => CARD_BY_ID[api.G.play!.cardId]?.name ?? '';

/** Гильдия шутов / Доктор Белолицый: заплатить $5 или получить карту перед собой. */
const payOrTake: Effect = {
  start: (api) => ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кого выбрать?' }),
  answer(api, p, c) {
    if (p.step === 'who') {
      const who = c as PlayerID;
      const labels: Record<string, string> = {};
      if (api.G.players[who].money >= 5) labels.pay = `Заплатить ${nameOf(api.G, api.pid)} $5`;
      labels.take = `Взять «${played(api)}» (будет лежать перед вами и занимать место в руке)`;
      return ask(api, {
        step: 'decide', kind: 'choice', actor: who, options: Object.keys(labels), labels,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { who },
      });
    }
    if (c === 'pay') {
      pay(api.G, p.data.who, api.pid, 5);
      say(api, `${nameOf(api.G, p.data.who)} платит $5`);
    } else {
      api.G.play!.toFront = p.data.who;
      say(api, `«${played(api)}» ляжет перед игроком ${nameOf(api.G, p.data.who)}`);
    }
    return null;
  },
};

/** Королева Молли / Гильдия нищих: соперник отдаёт две карты на свой выбор. */
const giveTwo: Effect = {
  start: (api) => ask(api, {
    step: 'who', kind: 'player', text: 'Кто отдаст вам две карты?',
    options: api.others.filter((o) => api.G.players[o].hand.length > 0),
  }),
  answer(api, p, c) {
    if (p.step === 'who') {
      const n = Math.min(2, api.G.players[c as string].hand.length);
      return ask(api, {
        step: 'give', kind: 'hand', actor: c as string, options: [], min: n, max: n,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»: отдайте ему ${n} карт(ы) на свой выбор`,
      });
    }
    moveCards(api.G, p.actor, api.pid, c as string[]);
    say(api, `получает карт: ${(c as string[]).length} от игрока ${nameOf(api.G, p.actor)}`);
    return null;
  },
};

/** Розмари Палм / Гильдия белошвеек: отдать свою карту, получить $2. */
const sellCard: Effect = {
  start(api) {
    if (!api.G.players[api.pid].hand.length) { say(api, 'нечего отдать'); return null; }
    return ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кому отдать карту за $2?' });
  },
  answer(api, p, c) {
    if (p.step === 'who') {
      return ask(api, { step: 'card', kind: 'hand', options: [], min: 1, max: 1, text: 'Какую карту отдать?', data: { who: c } });
    }
    moveCards(api.G, api.pid, p.data.who, c as string[]);
    say(api, `отдаёт карту игроку ${nameOf(api.G, p.data.who)} и получает $${pay(api.G, p.data.who, api.pid, 2)}`);
    return null;
  },
};

/** Санаторий: каждый по очереди даёт $1 или карту на свой выбор. */
function nextDonor(api: EffectApi, i: number): Next {
  for (let k = i; k < api.others.length; k++) {
    const o = api.others[k];
    const labels: Record<string, string> = {};
    if (api.G.players[o].money >= 1) labels.money = `Дать ${nameOf(api.G, api.pid)} $1`;
    if (api.G.players[o].hand.length) labels.card = `Дать ${nameOf(api.G, api.pid)} одну карту`;
    if (Object.keys(labels).length) {
      return ask(api, {
        step: 'donor', kind: 'choice', actor: o, options: Object.keys(labels), labels,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { i: k },
      });
    }
  }
  return null;
}

/** Аудиторы: каждый другой игрок по очереди убирает своего слугу. */
function nextVictim(api: EffectApi, i: number): Next {
  for (let k = i; k < api.others.length; k++) {
    const o = api.others[k];
    const opts = pieces(api.G, (p) => p.kind === 'minion' && p.owner === o);
    if (opts.length) {
      return ask(api, {
        step: 'victim', kind: 'piece', actor: o, options: opts,
        text: `«${played(api)}»: уберите одного своего слугу`, data: { i: k },
      });
    }
  }
  return null;
}

defineEffects({
  'fools-guild': payOrTake,
  drwhiteface: payOrTake,
  'fire-brigade': {
    start: (api) => ask(api, {
      step: 'who', kind: 'player', text: 'Кого выбрать (у кого есть здание)?',
      options: api.others.filter((o) => pieces(api.G, (p) => p.kind === 'building' && p.owner === o).length > 0),
    }),
    answer(api, p, c) {
      if (p.step === 'who') {
        const who = c as PlayerID;
        const labels: Record<string, string> = {};
        if (api.G.players[who].money >= 5) labels.pay = `Заплатить ${nameOf(api.G, api.pid)} $5`;
        labels.refuse = 'Не платить (вам могут убрать здание)';
        return ask(api, {
          step: 'decide', kind: 'choice', actor: who, options: Object.keys(labels), labels,
          text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { who },
        });
      }
      if (p.step === 'decide') {
        if (c === 'pay') {
          pay(api.G, p.data.who, api.pid, 5);
          say(api, `${nameOf(api.G, p.data.who)} платит $5`);
          return null;
        }
        return ask(api, {
          step: 'burn', kind: 'piece', text: 'Какое здание убрать?',
          options: pieces(api.G, (x) => x.kind === 'building' && x.owner === p.data.who),
        });
      }
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `убирает: ${pieceName(api.G, pc)}`);
      return null;
    },
  },
  'queen-molly': giveTwo,
  'beggars-guild': giveTwo,
  'rosie-palm': sellCard,
  'seamstresses-guild': sellCard,
  'ankh-morpork-sunshine-dragon-sanctuary': {
    start: (api) => nextDonor(api, 0),
    answer(api, p, c) {
      if (p.step === 'donor' && c === 'money') {
        pay(api.G, p.actor, api.pid, 1);
        say(api, `${nameOf(api.G, p.actor)} даёт $1`);
        return nextDonor(api, p.data.i + 1);
      }
      if (p.step === 'donor') {
        return ask(api, {
          step: 'card', kind: 'hand', actor: p.actor, options: [], min: 1, max: 1,
          text: `Какую карту отдать игроку ${nameOf(api.G, api.pid)}?`, data: { i: p.data.i },
        });
      }
      moveCards(api.G, p.actor, api.pid, c as string[]);
      say(api, `${nameOf(api.G, p.actor)} даёт карту`);
      return nextDonor(api, p.data.i + 1);
    },
  },
  auditors: {
    start: (api) => nextVictim(api, 0),
    answer(api, p, c) {
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `убран ${pieceName(api.G, pc)}`);
      return nextVictim(api, p.data.i + 1);
    },
  },
  'cosmo-lavish': {
    start(api) {
      if (api.G.players[api.pid].money < 2) { say(api, 'не хватает $2'); return null; }
      return ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кому заплатить $2?' });
    },
    answer(api, p, c) {
      if (p.step === 'who') {
        pay(api.G, api.pid, c as string, 2);
        say(api, `платит $2 игроку ${nameOf(api.G, c as string)}`);
        return ask(api, {
          step: 'victim', kind: 'piece', actor: c as string,
          text: `«${played(api)}»: уберите слугу (не ${nameOf(api.G, api.pid)}) из района с беспорядком`,
          options: pieces(api.G, (x) => isMinionLike(x) && x.owner !== api.pid && api.G.areas[x.area].trouble),
        });
      }
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `${nameOf(api.G, p.actor)} убирает: ${pieceName(api.G, pc)}`);
      return null;
    },
  },
});
