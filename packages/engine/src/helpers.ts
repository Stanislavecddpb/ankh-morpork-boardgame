import type { AMState, PlayerID } from './types';

const LOG_LIMIT = 300;

export function log(G: AMState, text: string): void {
  G.log.push(text);
  if (G.log.length > LOG_LIMIT) G.log.splice(0, G.log.length - LOG_LIMIT);
}

export function nameOf(G: AMState, pid: PlayerID): string {
  return G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;
}

/** Берёт до n карт с верха колоды в руку. Возвращает, сколько взято. */
export function drawCards(G: AMState, pid: PlayerID, n: number): number {
  let taken = 0;
  while (taken < n && G.deck.length > 0) {
    G.players[pid].hand.push(G.deck.shift()!);
    taken++;
  }
  return taken;
}
