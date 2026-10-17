import { areaDef } from '../data/areas';
import { nameOf } from '../helpers';
import { defineEffects, type EffectApi, type Next } from './run';
import { ask, isMinionLike, parsePiece, pay, pieceName, pieces, removePiece, say } from './ops';

function roll(api: EffectApi): number {
  api.lock();
  const r = api.rnd.d12();
  say(api, `на кубике ${r}`);
  return r;
}

const removeOwn = (api: EffectApi): Next =>
  ask(api, {
    step: 'kill', kind: 'piece', locked: true, text: 'Выпало 1: уберите одного своего слугу',
    options: pieces(api.G, (p) => p.kind === 'minion' && p.owner === api.pid),
  });

/** Карцер: по фишке из каждого выпавшего района, начиная с i. */
function killIn(api: EffectApi, areas: number[], i: number): Next {
  for (let k = i; k < areas.length; k++) {
    const opts = pieces(api.G, (p) => isMinionLike(p) && p.area === areas[k]);
    if (opts.length) {
      return ask(api, {
        step: 'kill', kind: 'piece', options: opts, locked: true,
        text: `Карцер: уберите слугу из района «${areaDef(areas[k]).name}»`, data: { areas, i: k },
      });
    }
  }
  return null;
}

function kill(api: EffectApi, c: unknown): void {
  const pc = parsePiece(c as string);
  removePiece(api.G, pc);
  say(api, `убирает: ${pieceName(api.G, pc)}`);
}

defineEffects({
  'cmot-dibbler': {
    start(api) {
      const r = roll(api);
      if (r >= 7) { api.G.players[api.pid].money += 4; say(api, '+$4'); return null; }
      if (r === 1) { pay(api.G, api.pid, 'bank', 1); say(api, 'платит банку $1'); return removeOwn(api); }
      return null;
    },
    answer: (api, _p, c) => { kill(api, c); return null; },
  },
  herennow: {
    start(api) {
      const r = roll(api);
      if (r >= 7) return ask(api, { step: 'who', kind: 'player', options: api.others, locked: true, text: 'У кого взять $3?' });
      if (r === 1) return removeOwn(api);
      return null;
    },
    answer(api, p, c) {
      if (p.step === 'who') say(api, `берёт $${pay(api.G, c as string, api.pid, 3)} у игрока ${nameOf(api.G, c as string)}`);
      else kill(api, c);
      return null;
    },
  },
  errol: {
    start(api) {
      const r = roll(api);
      if (r >= 7) {
        return ask(api, {
          step: 'kill', kind: 'piece', locked: true, text: 'Уберите слугу из района с беспорядком',
          options: pieces(api.G, (p) => isMinionLike(p) && api.G.areas[p.area].trouble),
        });
      }
      if (r === 1) return removeOwn(api);
      return null;
    },
    answer: (api, _p, c) => { kill(api, c); return null; },
  },
  carcer: {
    start(api) {
      const areas = [roll(api), roll(api)];
      return killIn(api, areas, 0);
    },
    answer(api, p, c) {
      kill(api, c);
      return killIn(api, p.data.areas, p.data.i + 1);
    },
  },
});
