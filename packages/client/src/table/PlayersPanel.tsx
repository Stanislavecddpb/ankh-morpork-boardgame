import { AREA_IDS, CARD_BY_ID, areaDef, controls, type AMState } from '@am/engine';
import { DISTRICT_TEXT } from './districtText';
import { ZoomImg } from './ZoomImg';
import { COLOR_HEX, cardImg, districtImg } from './assets';

export function PlayersPanel({ G, ctx, nameOf, onPick }: {
  G: AMState; ctx: any; nameOf: (pid: string) => string; onPick: (pid: string) => void;
}) {
  const order: string[] = Array.from({ length: ctx.numPlayers }, (_, i) => ctx.playOrder[(G.startIndex + i) % ctx.numPlayers]);
  return (
    <section className="players">
      {order.map((pid) => {
        const p = G.players[pid];
        const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id].minions[pid], 0);
        const districts = AREA_IDS.filter((id) => G.areas[id].building === pid);
        return (
          <div key={pid} className={`player ${ctx.currentPlayer === pid ? 'current' : ''}`} onClick={() => onPick(pid)}
            title="Нажмите: карточки районов и контроль"
            style={{ borderLeftColor: p.color ? COLOR_HEX[p.color] : undefined }}>
            <div className="player-head">
              <b>{nameOf(pid)}</b>
              <span className="money">${p.money}</span>
              {p.loans > 0 && <span className="loans" title="Займы">займ ×{p.loans}</span>}
            </div>
            <div className="player-stats">
              🂠 {p.hand.length} · слуги {onBoard}/{onBoard + p.minionSupply} · здания {6 - p.buildingSupply}/6
              {' · '}контроль {AREA_IDS.filter((id) => controls(G, pid, id)).length}
            </div>
            {districts.length > 0 && (
              <div className="player-districts">
                {districts.map((id) => {
                  const off = G.disabledDistricts.includes(id) || G.areas[id].demons > 0;
                  return <ZoomImg key={id} className={off ? 'district off' : 'district'} src={districtImg(id)} alt={`${areaDef(id).name}: ${DISTRICT_TEXT[id]}`} />;
                })}
              </div>
            )}
            {p.front.length > 0 && (
              <div className="player-front">
                {p.front.map((c) => <ZoomImg key={c} src={cardImg(c)} alt={CARD_BY_ID[c]?.name} />)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
