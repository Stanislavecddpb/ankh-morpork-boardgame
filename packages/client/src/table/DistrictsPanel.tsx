import { AREA_IDS, areaDef, controls, districtBlock, type AMState } from '@am/engine';
import { districtImg } from './assets';
import { DISTRICT_TEXT } from './districtText';

/** Мои карточки районов (здания) со способностями и подконтрольные районы. */
export function DistrictsPanel({ G, me, myTurn, moves }: {
  G: AMState; me: string; myTurn: boolean; moves: any;
}) {
  const mine = AREA_IDS.filter((id) => G.areas[id].building === me);
  const controlled = AREA_IDS.filter((id) => controls(G, me, id));
  return (
    <div className="districts-body">
      {mine.length === 0 && <div className="hand-empty">Карточек районов пока нет — постройте здание.</div>}
      {mine.map((id) => {
        const block = districtBlock(G, me, id);
        const off = G.disabledDistricts.includes(id) || G.areas[id].demons > 0;
        return (
          <figure key={id} className={`district-card ${off ? 'off' : ''}`}>
            <img src={districtImg(id)} alt={areaDef(id).name} />
            <figcaption>
              <b>{areaDef(id).name}</b>
              <span>{DISTRICT_TEXT[id]}</span>
              {id === 4
                ? <i>срабатывает сам при событиях</i>
                : !myTurn
                  ? <i>в свой ход</i>
                  : block
                    ? <i>{block}</i>
                    : <button className="btn" onClick={() => { moves.useDistrict(id); }}>Применить</button>}
            </figcaption>
          </figure>
        );
      })}
      <div className="controlled">
        <b>Под контролем</b>
        {controlled.length ? controlled.map((id) => <span key={id}>{areaDef(id).name}</span>) : <i>нет районов</i>}
      </div>
    </div>
  );
}
