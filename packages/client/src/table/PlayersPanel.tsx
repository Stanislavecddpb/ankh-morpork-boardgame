import { AREA_IDS, CARD_BY_ID, areaDef, usableDistricts, type AMState } from '@am/engine';
import { DISTRICT_TEXT } from './districtText';
import { COLOR_HEX, cardImg, districtImg } from './assets';

export function PlayersPanel({ G, ctx, me, moves, nameOf }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
}) {
  const usable = me && me === ctx.currentPlayer && !ctx.gameover ? usableDistricts(G, me) : [];
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
                {districts.map((id) => {
                  const off = G.disabledDistricts.includes(id) || G.areas[id].demons > 0;
                  const can = pid === me && usable.includes(id);
                  const tip = `${areaDef(id).name}: ${DISTRICT_TEXT[id]}${off ? ' (не работает)' : ''}`;
                  return can
                    ? <button key={id} className="district usable" title={`${tip} — нажмите, чтобы применить`} onClick={() => moves.useDistrict(id)}>
                        <img src={districtImg(id)} alt={areaDef(id).name} />
                      </button>
                    : <img key={id} className={off ? 'district off' : 'district'} src={districtImg(id)} alt={areaDef(id).name} title={tip} />;
                })}
              </div>
            )}
            {p.front.length > 0 && (
              <div className="player-front">
                {p.front.map((c) => <img key={c} src={cardImg(c)} alt={CARD_BY_ID[c]?.name} title={CARD_BY_ID[c]?.name} />)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
