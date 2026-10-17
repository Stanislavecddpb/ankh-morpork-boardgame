import type { AMState, AreaId, AreaState, PlayerID, Target } from './types';
import { AREA_IDS, areaDef } from './data/areas';

/** Слуги всех игроков + демоны + тролли. */
export function minionLikeCount(a: AreaState): number {
  return Object.values(a.minions).reduce((s, n) => s + n, 0) + a.demons + a.trolls;
}

export function areasWithMinionsOf(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => G.areas[id].minions[pid] > 0);
}

/** Районы со своим слугой и соседние с ними. */
export function legalMinionAreas(G: AMState, pid: PlayerID): AreaId[] {
  const set = new Set<AreaId>();
  for (const id of areasWithMinionsOf(G, pid)) {
    set.add(id);
    for (const n of areaDef(id).adjacent) set.add(n);
  }
  return AREA_IDS.filter((id) => set.has(id));
}

/** Вход слугоподобной фишки: беспорядок, если в районе уже кто-то есть. Вызывать ДО добавления фишки. */
function onEnter(a: AreaState): void {
  if (minionLikeCount(a) > 0) a.trouble = true;
}

/** Уход слугоподобной фишки снимает беспорядок. */
function onLeave(a: AreaState): void {
  a.trouble = false;
}

export function placeMinion(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const p = G.players[pid];
  if (!legalMinionAreas(G, pid).includes(area)) return 'Сюда нельзя поставить слугу';
  if (p.minionSupply === 0) {
    if (from == null || from === area || !(G.areas[from]?.minions[pid] > 0)) return 'Укажите, откуда переставить слугу';
    G.areas[from].minions[pid]--;
    onLeave(G.areas[from]);
  } else {
    if (from != null) return 'В запасе есть слуги';
    p.minionSupply--;
  }
  const a = G.areas[area];
  onEnter(a);
  a.minions[pid]++;
  return null;
}

export function canBuildIn(G: AMState, pid: PlayerID, area: AreaId): boolean {
  const a = G.areas[area];
  return !!a && a.minions[pid] > 0 && !a.trouble && a.building === null && G.players[pid].money >= areaDef(area).cost;
}

export function buildableAreas(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => canBuildIn(G, pid, id));
}

export function buildIn(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  if (!canBuildIn(G, pid, area)) return 'Здесь нельзя строить';
  const p = G.players[pid];
  if (p.buildingSupply === 0) {
    if (from == null || G.areas[from]?.building !== pid) return 'Укажите, какое здание перенести';
    G.areas[from].building = null;
  } else {
    if (from != null) return 'В запасе есть здания';
    p.buildingSupply--;
  }
  p.money -= areaDef(area).cost;
  G.areas[area].building = pid;
  return null;
}

export function assassinationTargets(G: AMState, pid: PlayerID, area: AreaId): Target[] {
  const a = G.areas[area];
  if (!a?.trouble) return [];
  const targets: Target[] = [];
  for (const [owner, n] of Object.entries(a.minions)) if (owner !== pid && n > 0) targets.push({ kind: 'minion', owner });
  if (a.demons > 0) targets.push({ kind: 'demon' });
  if (a.trolls > 0) targets.push({ kind: 'troll' });
  return targets;
}

export function assassinationAreas(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => assassinationTargets(G, pid, id).length > 0);
}

export function sameTarget(a: Target, b: Target): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'minion' || a.owner === (b as { owner: PlayerID }).owner;
}

/** Убирает фишку с поля (слуга возвращается владельцу в запас) и снимает беспорядок. */
export function removeTarget(G: AMState, area: AreaId, t: Target): void {
  const a = G.areas[area];
  if (t.kind === 'minion') {
    a.minions[t.owner]--;
    G.players[t.owner].minionSupply++;
  } else if (t.kind === 'demon') {
    a.demons--;
  } else {
    a.trolls--;
  }
  onLeave(a);
}

export function assassinate(G: AMState, pid: PlayerID, area: AreaId, t: Target): string | null {
  if (!assassinationTargets(G, pid, area).some((x) => sameTarget(x, t))) return 'Эту фишку нельзя убрать';
  removeTarget(G, area, t);
  return null;
}

export function troubleAreas(G: AMState): AreaId[] {
  return AREA_IDS.filter((id) => G.areas[id].trouble);
}

export function troubleCount(G: AMState): number {
  return troubleAreas(G).length;
}

export function removeTroubleIn(G: AMState, area: AreaId): string | null {
  if (!G.areas[area]?.trouble) return 'Здесь нет беспорядков';
  G.areas[area].trouble = false;
  return null;
}

/** Фишки игрока в районе для контроля: слуги + здание. */
export function piecesOf(a: AreaState, pid: PlayerID): number {
  return a.minions[pid] + (a.building === pid ? 1 : 0);
}

export function controls(G: AMState, pid: PlayerID, area: AreaId): boolean {
  const a = G.areas[area];
  const mine = piecesOf(a, pid);
  if (mine === 0 || a.demons > 0 || mine <= a.trolls) return false;
  return Object.keys(a.minions).every((o) => o === pid || piecesOf(a, o) < mine);
}
