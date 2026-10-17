import type { PersonalityId } from '../types';
import { nameOf } from '../helpers';
import { defineEffects, type EffectApi } from './run';
import { ask, pay, say } from './ops';

const choosePlayer = (api: EffectApi, step: string, text: string, filter: (p: string) => boolean = () => true, data = {}) =>
  ask(api, { step, kind: 'player', options: api.others.filter(filter), text, data });

const withCards = (api: EffectApi) => (p: string) => api.G.players[p].hand.length > 0;

defineEffects({
  'nobby-nobbs': {
    start: (api) => choosePlayer(api, 'who', 'У кого взять $3?'),
    answer(api, _p, c) {
      say(api, `берёт $${pay(api.G, c as string, api.pid, 3)} у игрока ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  hubert: {
    start: (api) => choosePlayer(api, 'payer', 'Кто заплатит $3?'),
    answer(api, p, c) {
      if (p.step === 'payer') {
        return choosePlayer(api, 'payee', `Кому ${nameOf(api.G, c as string)} заплатит $3?`, (o) => o !== c, { payer: c });
      }
      const n = pay(api.G, p.data.payer, c as string, 3);
      say(api, `${nameOf(api.G, p.data.payer)} платит $${n} игроку ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  'chair-of-indefinite-studies': {
    start: (api) => choosePlayer(api, 'who', 'С кем обменяться картами в руке?'),
    answer(api, _p, c) {
      api.lock();
      const me = api.G.players[api.pid];
      const them = api.G.players[c as string];
      [me.hand, them.hand] = [them.hand, me.hand];
      say(api, `меняется картами в руке с игроком ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  'cable-street-particulars': {
    start: (api) => choosePlayer(api, 'who', 'Чью руку посмотреть?', withCards(api)),
    answer(api, p, c) {
      if (p.step === 'who') {
        api.lock();
        const hand = [...api.G.players[c as string].hand];
        say(api, `смотрит карты игрока ${nameOf(api.G, c as string)}`);
        return ask(api, {
          step: 'pick', kind: 'reveal', options: hand, reveal: hand, locked: true,
          text: `Карты игрока ${nameOf(api.G, c as string)}: выберите одну для сброса`, data: { who: c },
        });
      }
      const hand = api.G.players[p.data.who].hand;
      hand.splice(hand.indexOf(c as string), 1);
      api.G.discard.push(c as string);
      say(api, `сбрасывает карту игрока ${nameOf(api.G, p.data.who)}`);
      return null;
    },
  },

  stanley: {
    start: (api) => choosePlayer(api, 'who', 'У кого вытянуть две карты?', withCards(api)),
    answer(api, p, c) {
      if (p.step === 'who') {
        api.lock();
        const hand = api.G.players[c as string].hand;
        const picked = api.rnd.shuffle(hand).slice(0, 2);
        for (const x of picked) hand.splice(hand.indexOf(x), 1);
        say(api, `тянет карты у игрока ${nameOf(api.G, c as string)}`);
        return ask(api, {
          step: 'keep', kind: 'reveal', options: picked, reveal: picked, locked: true,
          text: 'Какую карту оставить себе? Другая вернётся владельцу', data: { who: c, picked },
        });
      }
      api.G.players[api.pid].hand.push(c as string);
      for (const x of p.data.picked as string[]) if (x !== c) api.G.players[p.data.who].hand.push(x);
      say(api, 'оставляет себе одну карту');
      return null;
    },
  },

  'mrs-cake': {
    start(api) {
      if (api.G.spare.length < 2) { say(api, 'неиспользованных личностей слишком мало'); return null; }
      api.lock();
      const shown = api.rnd.shuffle(api.G.spare).slice(0, api.G.spare.length - 1);
      say(api, 'смотрит неиспользованные личности');
      return ask(api, {
        step: 'look', kind: 'reveal', options: ['ok'], reveal: shown, locked: true,
        text: 'Неиспользованные личности (кроме одной)',
      });
    },
    answer: () => null,
  },

  'zorgo-the-retrophrenologist': {
    start: (api) => (api.G.spare.length
      ? ask(api, {
          step: 'swap', kind: 'choice', options: ['swap', 'keep'],
          labels: { swap: 'Заменить личность на случайную', keep: 'Оставить свою' }, text: 'Заменить свою личность?',
        })
      : null),
    answer(api, _p, c) {
      if (c === 'keep') return null;
      api.lock();
      const pick = api.rnd.shuffle(api.G.spare)[0] as PersonalityId;
      const mine = api.G.players[api.pid].personality!;
      api.G.spare = api.G.spare.map((s) => (s === pick ? mine : s));
      api.G.players[api.pid].personality = pick;
      say(api, 'меняет свою личность на случайную');
      return null;
    },
  },
});
