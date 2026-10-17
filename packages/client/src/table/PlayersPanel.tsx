import { AREA_IDS, areaDef, type AMState } from '@am/engine';
import { COLOR_HEX, districtImg } from './assets';

export function PlayersPanel({ G, ctx, nameOf }: { G: AMState; ctx: any; nameOf: (pid: string) => string }) {
  const order: string[] = Array.from({ length: ctx.numPlayers }, (_, i) => ctx.playOrder[(G.startIndex + i) % ctx.numPlayers]);
  return (
    <section className="players">
      {order.map((pid) => {
        const p = G.players[pid];
        const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id].minions[pid], 0);
        const districts = AREA_IDS.filter((id) => G.areas[id].building === pid);
        return (
          <div key={pid} className={`player ${ctx.currentPlayer === pid ? 'current' : ''}`}
            style={{ borderLeftColor: p.color ? COLOR_HEX[p.color] : undefined }}>
            <div className="player-head">
              <b>{nameOf(pid)}</b>
              <span className="money">${p.money}</span>
              {p.loans > 0 && <span className="loans" title="Займы">займ ×{p.loans}</span>}
            </div>
            <div className="player-stats">
              🂠 {p.hand.length} · слуги {onBoard}/{onBoard + p.minionSupply} · здания {6 - p.buildingSupply}/6
            </div>
            {districts.length > 0 && (
              <div className="player-districts">
                {districts.map((id) => <img key={id} src={districtImg(id)} alt={areaDef(id).name} title={areaDef(id).name} />)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
