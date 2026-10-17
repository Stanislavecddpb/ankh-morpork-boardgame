import { COLORS, type AMState } from '@am/engine';
import { COLOR_HEX, COLOR_NAME } from './assets';
import { Page } from '../Page';

export function Lobby({ G, me, moves, nameOf, joined }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
  /** Сетевая игра: кто уже занял место (в хотсите — все). */
  joined?: (pid: string) => boolean;
}) {
  const pids = Object.keys(G.players);
  const isHost = me === '0';
  const waiting = joined ? pids.filter((pid) => !joined(pid)) : [];
  const ready = pids.every((pid) => G.players[pid].color) && waiting.length === 0;
  return (
    <Page title="Перед партией" subtitle="Выберите цвет фишек. Хост начинает игру, когда все готовы.">
      <section className="page-card">
        <div className="seat-list">
          {pids.map((pid) => {
            const color = G.players[pid].color;
            const canPick = me === pid || isHost;
            return (
              <div key={pid} className={`seat ${pid === me ? 'me' : ''}`} style={{ borderLeftColor: color ? COLOR_HEX[color] : undefined }}>
                <span className="seat-name">
                  {joined && !joined(pid) ? <i>ждём игрока…</i> : <><b>{nameOf(pid)}</b>{pid === me && ' (вы)'}</>}
                </span>
                <span className="swatches">
                  {COLORS.map((c) => {
                    const taken = pids.some((o) => o !== pid && G.players[o].color === c);
                    return (
                      <button key={c} className={`swatch ${color === c ? 'on' : ''}`} title={COLOR_NAME[c]}
                        style={{ background: COLOR_HEX[c] }} disabled={!canPick || taken}
                        onClick={() => moves.setColor(c, pid)} />
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
        {isHost && waiting.length > 0 && (
          <div className="page-note warn">Ещё не зашли: {waiting.length}. Отправьте друзьям ссылку («Скопировать ссылку» вверху).</div>
        )}
        {isHost
          ? <button className="btn" disabled={!ready} onClick={() => moves.startGame()}>Начать игру</button>
          : <div className="page-note">Ждём, пока хост начнёт игру…</div>}
      </section>
    </Page>
  );
}
