import { useEffect } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { AMState } from '@am/engine';
import { Lobby } from './Lobby';

interface MatchPlayer { id: number; name?: string }

export function NetBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.playerID} matchData={p.matchData as MatchPlayer[] | undefined} />;
}

export function HotseatBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.ctx.currentPlayer} />;
}

export interface TableProps {
  G: AMState; ctx: any; moves: any; undo: () => void; me: string | null; matchData?: MatchPlayer[];
}

export function Table({ G, ctx, moves, me, matchData }: TableProps) {
  const nameOf = (pid: string) => matchData?.find((m) => String(m.id) === pid)?.name || G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;

  // Имя из лобби boardgame.io переносим в состояние игры, чтобы оно попадало в лог.
  useEffect(() => {
    if (ctx.phase !== 'lobby' || !me || !matchData) return;
    const n = matchData.find((m) => String(m.id) === me)?.name;
    if (n && G.players[me]?.name !== n) moves.setName(n);
  }, [ctx.phase, me, matchData, G.players, moves]);

  if (ctx.phase === 'lobby') return <Lobby G={G} ctx={ctx} me={me} moves={moves} nameOf={nameOf} />;
  return <div className="table"><p>Поле в разработке. Ходит: {nameOf(ctx.currentPlayer)}</p></div>;
}
