import type { AMState, AreaId, AreaState, Color, PlayerID, PlayerState } from './types';
import { BUILDINGS_PER_PLAYER, COLORS, HAND_SIZE, MINIONS_PER_PLAYER, START_MONEY } from './types';
import { AREA_IDS, START_AREAS } from './data/areas';
import { CARDS, EVENTS, PERSONALITIES, TWO_PLAYER_REMOVED_CARDS, TWO_PLAYER_REMOVED_PERSONALITY } from './data/cards';

export type Shuffle = <T>(arr: T[]) => T[];

function emptyArea(pids: PlayerID[]): AreaState {
  return { minions: Object.fromEntries(pids.map((p) => [p, 0])), building: null, trouble: false, demons: 0, trolls: 0 };
}

export function setupGame(numPlayers: number, shuffle: Shuffle): AMState {
  const pids = Array.from({ length: numPlayers }, (_, i) => String(i));
  const two = numPlayers === 2;

  const personalities = shuffle(
    PERSONALITIES.map((p) => p.id).filter((id) => !(two && id === TWO_PLAYER_REMOVED_PERSONALITY)),
  );
  const allowed = (id: string) => !(two && TWO_PLAYER_REMOVED_CARDS.includes(id));
  const green = shuffle(CARDS.filter((c) => c.deck === 'green' && allowed(c.id)).map((c) => c.id));
  const brown = shuffle(CARDS.filter((c) => c.deck === 'brown' && allowed(c.id)).map((c) => c.id));
  const deck = [...green, ...brown];

  const areas: Record<AreaId, AreaState> = {};
  for (const id of AREA_IDS) areas[id] = emptyArea(pids);
  for (const id of START_AREAS) {
    for (const pid of pids) areas[id].minions[pid] = 1;
    areas[id].trouble = true;
  }

  const players: Record<PlayerID, PlayerState> = {};
  pids.forEach((pid, i) => {
    players[pid] = {
      name: `Игрок ${i + 1}`,
      color: null,
      money: START_MONEY,
      loans: 0,
      hand: deck.splice(0, HAND_SIZE),
      personality: personalities[i],
      minionSupply: MINIONS_PER_PLAYER - START_AREAS.length,
      buildingSupply: BUILDINGS_PER_PLAYER,
    };
  });

  return {
    started: false,
    startIndex: 0,
    areas,
    players,
    deck,
    discard: [],
    events: shuffle(EVENTS.map((e) => e.id)),
    lastEvent: null,
    play: null,
    playsLeft: 0,
    cardsPlayed: 0,
    log: [],
    gameover: null,
  };
}

/** Свой цвет выбирает любой игрок, чужой — только хост ('0', нужен для хотсита). */
export function applySetColor(G: AMState, actor: PlayerID, target: PlayerID, color: string): string | null {
  if (!COLORS.includes(color as Color)) return 'Нет такого цвета';
  if (!G.players[target]) return 'Нет такого игрока';
  if (actor !== target && actor !== '0') return 'Чужой цвет может менять только хост';
  if (Object.entries(G.players).some(([pid, p]) => pid !== target && p.color === color)) return 'Цвет занят';
  G.players[target].color = color as Color;
  return null;
}

export function applySetName(G: AMState, pid: PlayerID, name: string): string | null {
  const n = String(name).trim().slice(0, 20);
  if (!G.players[pid] || !n) return 'Пустое имя';
  G.players[pid].name = n;
  return null;
}
