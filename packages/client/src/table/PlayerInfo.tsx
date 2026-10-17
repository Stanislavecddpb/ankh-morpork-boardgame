import { AREA_IDS, CARD_BY_ID, areaDef, controls, type AMState } from '@am/engine';
import { COLOR_HEX, cardImg, districtImg } from './assets';
import { DISTRICT_TEXT } from './districtText';

/** Всё открытое об игроке: карточки районов, подконтрольные районы, карты перед ним. */
export function PlayerInfo({ G, pid, nameOf, onClose }: {
  G: AMState; pid: string; nameOf: (pid: string) => string; onClose: () => void;
}) {
  const p = G.players[pid];
  const districts = AREA_IDS.filter((id) => G.areas[id].building === pid);
  const controlled = AREA_IDS.filter((id) => controls(G, pid, id));
  const minions = AREA_IDS.filter((id) => G.areas[id].minions[pid] > 0);
  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-box player-info" onClick={(e) => e.stopPropagation()}
        style={{ borderTop: `6px solid ${p.color ? COLOR_HEX[p.color] : 'transparent'}` }}>
        <h2>{nameOf(pid)}</h2>
        <div className="player-info-stats">
          ${p.money}{p.loans > 0 && ` · займов ${p.loans}`} · карт в руке {p.hand.length} · слуг на поле {12 - p.minionSupply} · зданий {6 - p.buildingSupply}
        </div>
        <h3>Карточки районов</h3>
        <div className="reveal">
          {districts.length === 0 && <i>нет</i>}
          {districts.map((id) => {
            const off = G.disabledDistricts.includes(id) || G.areas[id].demons > 0;
            return (
              <figure key={id} className={off ? 'off' : ''} title={DISTRICT_TEXT[id]}>
                <img src={districtImg(id)} alt={areaDef(id).name} />
                <figcaption>{areaDef(id).name}{off && ' (не работает)'}</figcaption>
              </figure>
            );
          })}
        </div>
        <h3>Под контролем: {controlled.length}</h3>
        <div className="tags">{controlled.length ? controlled.map((id) => <span key={id}>{areaDef(id).name}</span>) : <i>нет</i>}</div>
        <h3>Слуги в районах: {minions.length}</h3>
        <div className="tags">{minions.map((id) => <span key={id}>{areaDef(id).name} ×{G.areas[id].minions[pid]}</span>)}</div>
        {p.front.length > 0 && (
          <>
            <h3>Карты перед игроком</h3>
            <div className="reveal">{p.front.map((c) => <img key={c} src={cardImg(c)} alt={CARD_BY_ID[c]?.name} />)}</div>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
