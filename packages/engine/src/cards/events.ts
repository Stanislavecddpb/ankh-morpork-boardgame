// Случайные события: все броски в начале, потом вопросы (все — без отмены).
import type { AMState, AreaId, PlayerID, Prompt } from '../types';
import { MAX_DEMONS, MAX_TROLLS } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { EVENT_BY_ID } from '../data/cards';
import { log, nameOf } from '../helpers';
import { troubleCount, troubleEnter } from '../rules';
import { advanceSymbol, currentSymbol } from '../turn';
import { scoreResult } from '../victory';
import { cardNames, moveMinion, removePiece } from './ops';
import { districtActive, SMALL_GODS } from './districts';
import { defineEffects, runEffect, type Effect, type EffectApi, type Next } from './run';

const PROTECT_COST = 3;
const SUBSIDENCE_COST = 2;
const FOG_CARDS = 5;
const RIOTS_TROUBLE = 8;

const areaName = (id: AreaId) => areaDef(id).name;

/** Владелец работающей карточки Мелких Богов. */
export function godsOwner(G: AMState): PlayerID | null {
  const owner = G.areas[SMALL_GODS].building;
  return owner && districtActive(G, SMALL_GODS, owner) ? owner : null;
}

function elog(api: EffectApi, text: string): void {
  log(api.G, `«${api.title}»: ${text}`);
}

function roll(api: EffectApi): AreaId {
  const r = api.rnd.d12();
  api.G.eventRolls.push(r);
  return r;
}

/** Угроза фишкам владельца Мелких Богов: count — сколько фишек можно защитить по $3. */
interface Threat { area: AreaId; what: 'building' | 'minion' | 'demon' | 'troll' | 'card'; count: number }

const THREAT_TEXT: Record<Threat['what'], string> = {
  building: 'здание',
  minion: 'слуг',
  demon: 'от демона',
  troll: 'от тролля',
  card: 'карточку района',
};

/** Здание и слуги владельца Мелких Богов в районе. */
function piecesAtRisk(G: AMState, owner: PlayerID | null, area: AreaId): Threat[] {
  if (!owner) return [];
  const a = G.areas[area];
  const out: Threat[] = [];
  if (a.building === owner) out.push({ area, what: 'building', count: 1 });
  if (a.minions[owner] > 0) out.push({ area, what: 'minion', count: a.minions[owner] });
  return out;
}

const hasPiecesOf = (G: AMState, owner: PlayerID | null, area: AreaId) =>
  !!owner && (G.areas[area].building === owner || G.areas[area].minions[owner] > 0);

interface Guarded {
  threats: Threat[];
  /** saved[i] — сколько фишек угрозы i защищено. */
  saved: number[];
  ti: number;
  [k: string]: any;
}

/** Событие с защитой Мелких Богов: prepare бросает кубики и находит угрозы, resolve применяет. */
function guarded(spec: {
  prepare(api: EffectApi, owner: PlayerID | null): { threats: Threat[]; [k: string]: any };
  resolve(api: EffectApi, d: Guarded): Next;
  answer?(api: EffectApi, p: Prompt, c: any): Next;
}): Effect {
  const next = (api: EffectApi, d: Guarded): Next => {
    const owner = godsOwner(api.G);
    while (owner && d.ti < d.threats.length) {
      const t = d.threats[d.ti];
      const max = Math.min(t.count, Math.floor(api.G.players[owner].money / PROTECT_COST));
      if (max > 0) {
        const opts = Array.from({ length: max + 1 }, (_, i) => i);
        const labels = Object.fromEntries(opts.map((i) => [i, i === 0 ? 'Не защищать' : t.count === 1 ? `Защитить ($${PROTECT_COST})` : `${i} ($${i * PROTECT_COST})`]));
        const what = t.count > 1 ? `${THREAT_TEXT[t.what]} (${t.count})` : THREAT_TEXT[t.what];
        return {
          step: 'guard', kind: 'choice', actor: owner, options: opts, labels, locked: true, data: d,
          text: `Мелкие Боги: защитить ${what} — ${areaName(t.area)}? $${PROTECT_COST} за фишку`,
        };
      }
      d.ti++;
    }
    return spec.resolve(api, d);
  };
  return {
    start: (api) => {
      const owner = godsOwner(api.G);
      return next(api, { ...spec.prepare(api, owner), owner, saved: [], ti: 0 });
    },
    answer: (api, p, c) => {
      if (p.step !== 'guard') return spec.answer!(api, p, c);
      const d = p.data as Guarded;
      const n = Number(c);
      if (n > 0) {
        api.G.players[p.actor].money -= n * PROTECT_COST;
        elog(api, `${nameOf(api.G, p.actor)} платит $${n * PROTECT_COST} Мелким Богам — ${areaName(d.threats[d.ti].area)}`);
      }
      d.saved[d.ti] = n;
      d.ti++;
      return next(api, d);
    },
  };
}

/** Сколько защищено фишек вида what в районе. */
const savedFor = (d: Guarded, area: AreaId, what: Threat['what']) =>
  d.threats.reduce((s, t, i) => s + (t.area === area && t.what === what ? d.saved[i] ?? 0 : 0), 0);

/** Снести здание (если не защищено). */
function burnBuilding(api: EffectApi, d: Guarded, area: AreaId, verb: string): void {
  const owner = api.G.areas[area].building;
  if (!owner) return;
  if (savedFor(d, area, 'building') > 0) {
    elog(api, `здание ${nameOf(api.G, owner)} (${areaName(area)}) защищено`);
    return;
  }
  removePiece(api.G, { area, kind: 'building', owner });
  elog(api, `${verb} здание ${nameOf(api.G, owner)} — ${areaName(area)}`);
}

const buildingsEvent = (rolls: number, verb: string) => guarded({
  prepare: (api, owner) => {
    const areas = [...new Set(Array.from({ length: rolls }, () => roll(api)))];
    elog(api, `на кубике ${api.G.eventRolls.join(', ')} — ${areas.map(areaName).join(', ')}`);
    return { areas, threats: areas.filter((a) => api.G.areas[a].building === owner).map((area) => ({ area, what: 'building' as const, count: 1 })) };
  },
  resolve: (api, d) => {
    for (const a of d.areas as AreaId[]) {
      if (api.G.areas[a].building) burnBuilding(api, d, a, verb);
      else elog(api, `${areaName(a)}: зданий нет`);
    }
    return null;
  },
});

/** Поставить демонов или троллей по броскам. */
const monstersEvent = (kind: 'demon' | 'troll') => guarded({
  prepare: (api, owner) => {
    const G = api.G;
    const max = kind === 'demon' ? MAX_DEMONS : MAX_TROLLS;
    const onBoard = AREA_IDS.reduce((s, id) => s + (kind === 'demon' ? G.areas[id].demons : G.areas[id].trolls), 0);
    const rolls = Array.from({ length: kind === 'demon' ? 4 : 3 }, () => roll(api));
    const places = rolls.slice(0, Math.max(0, max - onBoard));
    elog(api, `на кубике ${rolls.join(', ')}${places.length < rolls.length ? ` (в запасе только ${places.length})` : ''}`);
    return { places, threats: places.filter((a) => hasPiecesOf(G, owner, a)).map((area) => ({ area, what: kind, count: 1 })) };
  },
  resolve: (api, d) => {
    const G = api.G;
    const skip = new Map<AreaId, number>();
    d.threats.forEach((t, i) => { if (d.saved[i]) skip.set(t.area, (skip.get(t.area) ?? 0) + 1); });
    for (const area of d.places as AreaId[]) {
      if (skip.get(area)) {
        skip.set(area, skip.get(area)! - 1);
        elog(api, `Мелкие Боги не пустили ${kind === 'demon' ? 'демона' : 'тролля'} — ${areaName(area)}`);
        continue;
      }
      const a = G.areas[area];
      if (kind === 'demon') {
        a.trouble = true;
        a.demons++;
      } else {
        troubleEnter(a);
        a.trolls++;
      }
      elog(api, `${kind === 'demon' ? 'демон' : 'тролль'} — ${areaName(area)}`);
    }
    return null;
  },
});

// ——— Наводнение ———
function floodNext(api: EffectApi, d: any): Next {
  const G = api.G;
  const order = [api.pid, ...api.others];
  for (; d.pi < order.length; d.pi++) {
    const pid = order[d.pi];
    for (const area of d.flooded as AreaId[]) {
      if (G.areas[area].minions[pid] < 1) continue;
      const dest = areaDef(area).adjacent.filter((n) => !d.flooded.includes(n));
      if (dest.length === 0) continue;
      return {
        step: 'flood', kind: 'choice', actor: pid, options: dest, locked: true, data: { ...d, from: area },
        labels: Object.fromEntries(dest.map((n) => [n, areaName(n)])),
        text: `Наводнение: куда увести слугу из района ${areaName(area)}? (там ещё ${G.areas[area].minions[pid]})`,
      };
    }
  }
  return null;
}

// ——— Таинственные убийства ———
function murdersNext(api: EffectApi, d: any): Next {
  const G = api.G;
  const order = [api.pid, ...api.others];
  while (d.pi < order.length) {
    const pid = order[d.pi];
    const area = roll(api);
    const owners = Object.keys(G.areas[area].minions).filter((o) => G.areas[area].minions[o] > 0);
    elog(api, `${nameOf(G, pid)}: на кубике ${area} — ${areaName(area)}`);
    if (owners.length === 0) { elog(api, 'слуг там нет'); d.pi++; continue; }
    if (owners.length === 1) {
      const r = murderPick(api, d, area, owners[0]);
      if (r) return r;
      continue;
    }
    return {
      step: 'murder', kind: 'choice', actor: pid, options: owners, locked: true, data: { ...d, area },
      labels: Object.fromEntries(owners.map((o) => [o, `Слуга ${nameOf(G, o)}`])),
      text: `Таинственные убийства: чьего слугу убрать — ${areaName(area)}?`,
    };
  }
  return null;
}

/** Выбран слуга: спросить Мелких Богов или убрать. Возвращает вопрос или null (идём дальше). */
function murderPick(api: EffectApi, d: any, area: AreaId, victim: PlayerID): Next {
  const G = api.G;
  const owner = godsOwner(G);
  if (owner === victim && G.players[owner].money >= PROTECT_COST) {
    return {
      step: 'mguard', kind: 'choice', actor: owner, options: [0, 1], locked: true, data: { ...d, area, victim },
      labels: { 0: 'Не защищать', 1: `Защитить ($${PROTECT_COST})` },
      text: `Мелкие Боги: защитить слугу — ${areaName(area)}? $${PROTECT_COST}`,
    };
  }
  murderDo(api, area, victim);
  d.pi++;
  return null;
}

function murderDo(api: EffectApi, area: AreaId, victim: PlayerID): void {
  removePiece(api.G, { area, kind: 'minion', owner: victim });
  elog(api, `убит слуга ${nameOf(api.G, victim)} — ${areaName(area)}`);
}

// ——— Обрушение ———
function subsidenceNext(api: EffectApi, d: any): Next {
  const G = api.G;
  const order = [api.pid, ...api.others];
  for (; d.pi < order.length; d.pi++) {
    const pid = order[d.pi];
    const p = G.players[pid];
    const mine = AREA_IDS.filter((id) => G.areas[id].building === pid);
    if (mine.length === 0) continue;
    const affordable = Math.floor(p.money / SUBSIDENCE_COST);
    if (mine.length > affordable) {
      return {
        step: 'subside', kind: 'choice', actor: pid, options: mine, locked: true, data: d,
        labels: Object.fromEntries(mine.map((n) => [n, areaName(n)])),
        text: `Обрушение: не хватает денег на все здания ($${SUBSIDENCE_COST} за каждое). Какое снести? (ещё ${mine.length - affordable})`,
      };
    }
    p.money -= mine.length * SUBSIDENCE_COST;
    elog(api, `${nameOf(G, pid)} платит $${mine.length * SUBSIDENCE_COST}`);
  }
  return null;
}

defineEffects({
  'event:the-dragon': guarded({
    prepare: (api, owner) => {
      const area = roll(api);
      elog(api, `на кубике ${area} — ${areaName(area)}`);
      return { area, threats: piecesAtRisk(api.G, owner, area) };
    },
    resolve: (api, d) => {
      const G = api.G;
      const area = d.area as AreaId;
      const a = G.areas[area];
      for (const pid of Object.keys(a.minions)) {
        const keep = pid === d.owner ? savedFor(d, area, 'minion') : 0;
        while (a.minions[pid] > keep) removePiece(G, { area, kind: 'minion', owner: pid });
      }
      a.demons = 0;
      a.trolls = 0;
      if (a.building) burnBuilding(api, d, area, 'сожжено');
      a.trouble = false;
      elog(api, `район ${areaName(area)} опустошён`);
      return null;
    },
  }),
  'event:explosion': buildingsEvent(1, 'взорвано'),
  'event:earthquake': buildingsEvent(2, 'разрушено'),
  'event:fire': guarded({
    prepare: (api, owner) => {
      const G = api.G;
      const burned: AreaId[] = [];
      let last = roll(api);
      if (G.areas[last].building) {
        burned.push(last);
        for (;;) {
          const r = roll(api);
          const ok = areaDef(last).adjacent.includes(r) && !!G.areas[r].building && !burned.includes(r);
          last = r;
          if (!ok) break;
          burned.push(r);
        }
      }
      elog(api, `на кубике ${G.eventRolls.join(', ')}${burned.length ? ` — горит: ${burned.map(areaName).join(', ')}` : ' — пожар не начался'}`);
      return { burned, threats: burned.filter((a) => G.areas[a].building === owner).map((area) => ({ area, what: 'building' as const, count: 1 })) };
    },
    resolve: (api, d) => {
      for (const a of d.burned as AreaId[]) burnBuilding(api, d, a, 'сгорело');
      return null;
    },
  }),
  'event:demons-from-dungeon-dimensions': monstersEvent('demon'),
  'event:trolls': monstersEvent('troll'),
  'event:bloody-stupid-johnson': guarded({
    prepare: (api, owner) => {
      const G = api.G;
      const area = roll(api);
      elog(api, `на кубике ${area} — ${areaName(area)}`);
      const b = G.areas[area].building;
      const threats: Threat[] = [];
      if (b && b === owner) {
        if (!G.disabledDistricts.includes(area)) threats.push({ area, what: 'card', count: 1 });
        if (G.areas[area].minions[b] > 0) threats.push({ area, what: 'minion', count: 1 });
      }
      return { area, threats };
    },
    resolve: (api, d) => {
      const G = api.G;
      const area = d.area as AreaId;
      const b = G.areas[area].building;
      if (!b) { elog(api, 'здания там нет — ничего не случилось'); return null; }
      if (savedFor(d, area, 'card')) elog(api, 'карточка района защищена');
      else if (!G.disabledDistricts.includes(area)) {
        G.disabledDistricts.push(area);
        elog(api, `карточка «${areaName(area)}» отложена — способность больше не работает`);
      }
      if (G.areas[area].minions[b] > 0) {
        if (savedFor(d, area, 'minion')) elog(api, 'слуга защищён');
        else {
          removePiece(G, { area, kind: 'minion', owner: b });
          elog(api, `${nameOf(G, b)} теряет слугу — ${areaName(area)}`);
        }
      }
      return null;
    },
  }),
  'event:fog': {
    start: (api) => {
      const cards = api.G.deck.splice(0, FOG_CARDS);
      api.G.discard.push(...cards);
      elog(api, cards.length ? `в сброс: ${cardNames(cards)}` : 'колода пуста');
      return null;
    },
  },
  'event:riots': {
    start: (api) => {
      const G = api.G;
      const n = troubleCount(G);
      if (n < RIOTS_TROUBLE) { elog(api, `беспорядков ${n} из ${RIOTS_TROUBLE} — ничего не случилось`); return null; }
      G.gameover = { ...scoreResult(G), reason: 'riots' };
      elog(api, `беспорядков ${n} — игра окончена, подсчёт очков`);
      return null;
    },
  },
  'event:flood': {
    start: (api) => {
      const rolls = [roll(api), roll(api)];
      const flooded = [...new Set(rolls)].filter((a) => areaDef(a).river);
      elog(api, `на кубике ${rolls.join(', ')} — ${flooded.length ? `затоплено: ${flooded.map(areaName).join(', ')}` : 'река не вышла из берегов'}`);
      return floodNext(api, { flooded, pi: 0 });
    },
    answer: (api, p, c) => {
      const G = api.G;
      const from = p.data.from as AreaId;
      const to = Number(c);
      moveMinion(G, p.actor, from, to);
      elog(api, `${nameOf(G, p.actor)} уводит слугу: ${areaName(from)} → ${areaName(to)}`);
      return floodNext(api, p.data);
    },
  },
  'event:mysterious-murders': {
    start: (api) => murdersNext(api, { pi: 0 }),
    answer: (api, p, c) => {
      const d = p.data;
      if (p.step === 'murder') return murderPick(api, d, d.area, String(c)) ?? murdersNext(api, d);
      if (Number(c) === 1) {
        api.G.players[p.actor].money -= PROTECT_COST;
        elog(api, `${nameOf(api.G, p.actor)} платит $${PROTECT_COST} Мелким Богам — слуга спасён`);
      } else murderDo(api, d.area, d.victim);
      d.pi++;
      return murdersNext(api, d);
    },
  },
  'event:subsidence': {
    start: (api) => subsidenceNext(api, { pi: 0 }),
    answer: (api, p, c) => {
      const area = Number(c);
      removePiece(api.G, { area, kind: 'building', owner: p.actor });
      elog(api, `рушится здание ${nameOf(api.G, p.actor)} — ${areaName(area)}`);
      return subsidenceNext(api, p.data);
    },
  },
});

/** Символ «случайное событие»: вытянуть и разыграть. */
export function startEvent(api: EffectApi): string | null {
  const { G } = api;
  if (currentSymbol(G)?.kind !== 'event') return 'Сейчас другое действие';
  if (G.prompt) return 'Сначала ответьте на вопрос';
  api.lock();
  const ev = G.events.shift();
  if (!ev) {
    log(G, 'Случайные события закончились');
    advanceSymbol(G);
    return null;
  }
  G.lastEvent = ev;
  G.eventRolls = [];
  log(G, `Случайное событие: «${EVENT_BY_ID[ev].name}»`);
  return runEffect(api, `event:${ev}`, 'event', (eff) => eff.start(api));
}
