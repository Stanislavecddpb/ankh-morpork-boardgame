import { useMemo, useState } from 'react';
import { Client } from 'boardgame.io/react';
import { AnkhMorporkGame } from '@am/engine';
import { HotseatBoard } from './table/Table';
import { Page, PlayerCountPicker } from './Page';

// Хотсит: один клиент без сервера. Скрытие информации выключено (playerView: undefined),
// а интерфейс сам показывает руку и личность только текущего игрока.
function makeHotseatClient(numPlayers: number) {
  return Client({
    game: { ...AnkhMorporkGame, playerView: undefined },
    board: HotseatBoard,
    numPlayers,
    debug: false,
  });
}

export function LocalGame() {
  const [numPlayers, setNumPlayers] = useState(4);
  const [started, setStarted] = useState(false);
  const HotseatClient = useMemo(() => makeHotseatClient(numPlayers), [numPlayers]);

  if (!started) {
    return (
      <Page title="Локальная игра" subtitle="За одним компьютером — ходите по очереди за всех.">
        <section className="page-card">
          <div className="page-field">Игроков
            <PlayerCountPicker value={numPlayers} onChange={setNumPlayers} />
          </div>
          <button className="btn" onClick={() => setStarted(true)}>Начать</button>
        </section>
        <a className="page-link" href="#/">← На главную</a>
      </Page>
    );
  }
  return <HotseatClient matchID="local" />;
}
