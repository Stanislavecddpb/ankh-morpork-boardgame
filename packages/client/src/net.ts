import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LobbyClient } from 'boardgame.io/client';
import { AnkhMorporkGame, GAME_ID } from '@am/engine';
import { NetBoard } from './table/Table';

// dev (Vite на 5173) — сервер на том же хосте, порт 3001; prod — тот же origin.
export const SERVER =
  import.meta.env.VITE_SERVER ?? (import.meta.env.DEV ? `http://${location.hostname}:3001` : location.origin);

export const lobby = new LobbyClient({ server: SERVER });

export const NetClient = Client({
  game: AnkhMorporkGame,
  board: NetBoard,
  multiplayer: SocketIO({ server: SERVER }),
  debug: false,
});

export { GAME_ID };

export interface Seat {
  playerID: string;
  credentials: string;
  name: string;
}

const seatKey = (matchID: string) => `am:seat:${matchID}`;

export function loadSeat(matchID: string): Seat | null {
  try {
    const raw = localStorage.getItem(seatKey(matchID));
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function saveSeat(matchID: string, seat: Seat): void {
  try {
    localStorage.setItem(seatKey(matchID), JSON.stringify(seat));
  } catch {
    /* приватный режим — место не запомнится */
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem('am:name') ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string): void {
  try {
    localStorage.setItem('am:name', name);
  } catch {
    /* ignore */
  }
}
