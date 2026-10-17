import { useState } from 'react';
import { lobby, GAME_ID, saveSeat, savedName, rememberName } from './net';
import { Page, PlayerCountPicker } from './Page';

export function Home() {
  const [name, setName] = useState(savedName() || 'Игрок');
  const [numPlayers, setNumPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGame() {
    setBusy(true);
    setError(null);
    try {
      rememberName(name);
      const { matchID } = await lobby.createMatch(GAME_ID, { numPlayers });
      const { playerCredentials } = await lobby.joinMatch(GAME_ID, matchID, { playerID: '0', playerName: name });
      saveSeat(matchID, { playerID: '0', credentials: playerCredentials, name });
      location.hash = `#/m/${matchID}`;
    } catch {
      setError('Не удалось создать игру. Сервер запущен?');
    } finally {
      setBusy(false);
    }
  }

  function joinByCode() {
    const code = joinCode.trim();
    if (code) location.hash = `#/m/${code}`;
  }

  return (
    <Page subtitle="Тайные личности, слуги, беспорядки и борьба за власть в самом неуправляемом городе Плоского мира.">
      <div className="home">
        <section className="page-card">
          <h2>Созвать игру</h2>
          <label>Ваше имя
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          </label>
          <div className="page-field">Игроков
            <PlayerCountPicker value={numPlayers} onChange={setNumPlayers} />
          </div>
          <button className="btn" disabled={busy} onClick={createGame}>{busy ? 'Создаём…' : 'Создать игру'}</button>
          {error && <div className="err">{error}</div>}
        </section>

        <section className="page-card">
          <h2>Вступить в игру</h2>
          <label>Код партии от друга
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') joinByCode(); }} />
          </label>
          <button className="btn ghost" disabled={!joinCode.trim()} onClick={joinByCode}>Присоединиться</button>
        </section>

        <a className="page-link" href="#/local">Локальная игра за одним компьютером →</a>
      </div>
    </Page>
  );
}
