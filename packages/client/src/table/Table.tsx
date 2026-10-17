import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import {
  areasWithMinionsOf, assassinationAreas, assassinationTargets, buildableAreas, currentSymbol,
  legalMinionAreas, troubleAreas, AREA_IDS, type AMState, type AreaId, type Target,
} from '@am/engine';
import { Lobby } from './Lobby';
import { BoardView } from './BoardView';
import { Hand } from './Hand';
import { ActionPanel } from './ActionPanel';
import { PlayersPanel } from './PlayersPanel';
import { LogPanel } from './LogPanel';
import { personalityImg } from './assets';
import { ManualPanel, ManualAreaMenu } from './ManualPanel';
import { GameOverPanel } from './GameOverPanel';
import { Supply, type DragPiece } from './Supply';
import { Decks } from './Decks';

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

export function Table({ G, ctx, moves, undo, me, matchData }: TableProps) {
  const [manualOn, setManualOn] = useState(false);
  const [from, setFrom] = useState<AreaId | null>(null);
  const [menuArea, setMenuArea] = useState<AreaId | null>(null);

  const nameOf = (pid: string) =>
    matchData?.find((m) => String(m.id) === pid)?.name || G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;

  useEffect(() => {
    if (ctx.phase !== 'lobby' || !me || !matchData) return;
    const n = matchData.find((m) => String(m.id) === me)?.name;
    if (n && G.players[me]?.name !== n) moves.setName(n);
  }, [ctx.phase, me, matchData, G.players, moves]);

  // Сброс выбора при смене символа или хода.
  const sym = currentSymbol(G);
  useEffect(() => { setFrom(null); setMenuArea(null); }, [sym?.kind, G.play?.queue.length, ctx.turn]);
  useEffect(() => { setManualOn(false); }, [ctx.turn]);

  if (ctx.phase === 'lobby') return <Lobby G={G} ctx={ctx} me={me} moves={moves} nameOf={nameOf} />;

  const myTurn = me === ctx.currentPlayer && !ctx.gameover;
  const mine = me ? G.players[me] : null;

  let highlight: AreaId[] = [];
  let onArea: (id: AreaId) => void = () => {};
  if (myTurn && manualOn) {
    highlight = AREA_IDS;
    onArea = (id) => setMenuArea(id);
  } else if (myTurn && sym && me && mine) {
    if (sym.kind === 'minion') {
      if (mine.minionSupply > 0) { highlight = legalMinionAreas(G, me); onArea = (id) => moves.placeMinion(id); }
      else if (from == null) { highlight = areasWithMinionsOf(G, me); onArea = setFrom; }
      else { highlight = legalMinionAreas(G, me).filter((id) => id !== from); onArea = (id) => moves.placeMinion(id, from); }
    } else if (sym.kind === 'building') {
      if (mine.buildingSupply > 0) { highlight = buildableAreas(G, me); onArea = (id) => moves.build(id); }
      else if (from == null) { highlight = AREA_IDS.filter((id) => G.areas[id].building === me); onArea = setFrom; }
      else { highlight = buildableAreas(G, me); onArea = (id) => moves.build(id, from); }
    } else if (sym.kind === 'assassinate') {
      highlight = assassinationAreas(G, me);
      onArea = setMenuArea;
    } else if (sym.kind === 'removeTrouble') {
      highlight = troubleAreas(G);
      onArea = (id) => moves.removeTrouble(id);
    }
  }

  /** Фишка из запаса брошена на район: по символу карты или ручной правкой. */
  function onDropPiece(area: AreaId, piece: DragPiece) {
    if (!myTurn || !me) return;
    if (manualOn) {
      if (piece.kind === 'minion') moves.manual({ type: 'minion', area, owner: piece.owner, delta: 1 });
      else if (piece.kind === 'building') moves.manual({ type: 'building', area, owner: piece.owner });
      else if (piece.kind === 'trouble') moves.manual({ type: 'trouble', area, on: true });
      else moves.manual({ type: piece.kind, area, delta: 1 });
      return;
    }
    if (piece.kind === 'minion' && piece.owner === me && sym?.kind === 'minion') moves.placeMinion(area);
    if (piece.kind === 'building' && piece.owner === me && sym?.kind === 'building') moves.build(area);
  }
  const canDrag = myTurn && (sym?.kind === 'minion' || sym?.kind === 'building');

  const targetName = (t: Target) => (t.kind === 'minion' ? `Слуга: ${nameOf(t.owner)}` : t.kind === 'demon' ? 'Демон' : 'Тролль');

  return (
    <div className="table">
      <div className="table-board">
        <Supply G={G} me={me} manual={myTurn && manualOn} canDrag={canDrag} nameOf={nameOf} />
        <BoardView G={G} highlight={highlight} selected={from ?? menuArea} onArea={onArea} onDropPiece={onDropPiece} />
        <Decks G={G} />
      </div>
      <aside className="table-side">
        <PlayersPanel G={G} ctx={ctx} nameOf={nameOf} />
        <ActionPanel G={G} ctx={ctx} me={me} moves={moves} undo={undo} nameOf={nameOf} from={from} />
        {myTurn && me && <ManualPanel G={G} me={me} moves={moves} nameOf={nameOf} on={manualOn} setOn={(v) => { setManualOn(v); setMenuArea(null); }} />}
        <LogPanel log={G.log} />
      </aside>
      <footer className="table-foot">
        <Hand G={G} me={me} canPlay={myTurn && !G.play && G.playsLeft > 0 && !manualOn} onPlay={(id) => moves.playCard(id)} />
        {mine?.personality && <img className="personality" src={personalityImg(mine.personality)} alt="Ваша личность" title="Ваша личность (видна только вам)" />}
      </footer>

      {menuArea != null && !manualOn && sym?.kind === 'assassinate' && me && (
        <div className="popup" onClick={() => setMenuArea(null)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h3>Кого убрать?</h3>
            {assassinationTargets(G, me, menuArea).map((t, i) => (
              <button key={i} className="btn" onClick={() => { moves.assassinate(menuArea, t); setMenuArea(null); }}>{targetName(t)}</button>
            ))}
            <button className="btn ghost" onClick={() => setMenuArea(null)}>Отмена</button>
          </div>
        </div>
      )}
      {menuArea != null && manualOn && (
        <ManualAreaMenu G={G} area={menuArea} moves={moves} nameOf={nameOf} onClose={() => setMenuArea(null)} />
      )}
      {G.gameover && <GameOverPanel G={G} nameOf={nameOf} />}
    </div>
  );
}
