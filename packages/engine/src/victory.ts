import type { AMState, GameOver, PersonalityId, PlayerID } from './types';
import { LOAN_REPAY, UNPAID_LOAN_PENALTY } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { areasWithMinionsOf, controls, troubleCount } from './rules';

export const LORD_AREAS: Record<number, number> = { 2: 7, 3: 5, 4: 4 };
export const VETINARI_AREAS: Record<number, number> = { 2: 11, 3: 10, 4: 9 };
export const DRAGON_TROUBLE = 8;
export const CHRYSOPRASE_WORTH = 50;

export function buildingValue(G: AMState, pid: PlayerID): number {
  return AREA_IDS.filter((id) => G.areas[id].building === pid).reduce((s, id) => s + areaDef(id).cost, 0);
}

export function netWorth(G: AMState, pid: PlayerID): number {
  const p = G.players[pid];
  return p.money + buildingValue(G, pid) - LOAN_REPAY * p.loans;
}

/** Проверка в начале хода игрока pid. Ваймс здесь никогда не побеждает. */
export function hasWon(G: AMState, pid: PlayerID, numPlayers: number): boolean {
  switch (G.players[pid].personality) {
    case 'lord-selachii':
    case 'lord-rust':
    case 'lord-de-worde':
      return AREA_IDS.filter((id) => controls(G, pid, id)).length >= LORD_AREAS[numPlayers];
    case 'lord-vetinari':
      return areasWithMinionsOf(G, pid).length >= VETINARI_AREAS[numPlayers];
    case 'dragon-king-of-arms':
      return troubleCount(G) >= DRAGON_TROUBLE;
    case 'chrysoprase':
      return netWorth(G, pid) >= CHRYSOPRASE_WORTH;
    default:
      return false;
  }
}

export function allPersonalities(G: AMState): Record<PlayerID, PersonalityId> {
  return Object.fromEntries(Object.entries(G.players).map(([pid, p]) => [pid, p.personality!]));
}

export function finalScore(G: AMState, pid: PlayerID): number {
  const p = G.players[pid];
  let money = p.money;
  let penalty = 0;
  for (let i = 0; i < p.loans; i++) {
    if (money >= LOAN_REPAY) money -= LOAN_REPAY;
    else penalty += UNPAID_LOAN_PENALTY;
  }
  const minions = AREA_IDS.reduce((s, id) => s + G.areas[id].minions[pid], 0);
  return minions * 5 + buildingValue(G, pid) + money - penalty;
}

export function bestDistrictCost(G: AMState, pid: PlayerID): number {
  return Math.max(0, ...AREA_IDS.filter((id) => G.areas[id].building === pid).map((id) => areaDef(id).cost));
}

/** Победитель по очкам (ничья — дороже район). */
export function scoreResult(G: AMState): GameOver {
  const pids = Object.keys(G.players);
  const scores = Object.fromEntries(pids.map((pid) => [pid, finalScore(G, pid)]));
  const winner = [...pids].sort(
    (a, b) => scores[b] - scores[a] || bestDistrictCost(G, b) - bestDistrictCost(G, a),
  )[0];
  return { winner, reason: 'score', personalities: allPersonalities(G), scores };
}

/** Итог, когда закончилась колода. */
export function deckOutResult(G: AMState): GameOver {
  const vimes = Object.keys(G.players).find((pid) => G.players[pid].personality === 'commander-vimes');
  if (vimes) return { winner: vimes, reason: 'vimes', personalities: allPersonalities(G) };
  return scoreResult(G);
}
