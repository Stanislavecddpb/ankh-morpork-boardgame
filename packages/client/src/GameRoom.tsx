import { useCallback, useEffect, useState } from 'react';
import { Page } from './Page';
import { lobby, GAME_ID, NetClient, loadSeat, saveSeat, forgetSeat, savedName, rememberName, type Seat } from './net';

interface MatchPlayer {
  id: number;
  name?: string;
}

export function GameRoom({ matchID }: { matchID: string }) {
  const [players, setPlayers] = useState<MatchPlayer[] | null>(null);
  const [seat, setSeat] = useState<Seat | null>(loadSeat(matchID));
  const [name, setName] = useState(savedName() || 'Игрок');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const m = await lobby.getMatch(GAME_ID, matchID);
      setPlayers(m.players as MatchPlayer[]);
      // Место освободили снаружи (платформа) — сохранённый вход больше не действует.
      const mine = loadSeat(matchID);
      if (mine && (m.players as MatchPlayer[])[Number(mine.playerID)]?.name !== mine.name) {
        forgetSeat(matchID);
        setSeat(null);
      }
      setError(null);
    } catch {
      setError('Партия не найдена. Проверьте код.');
    }
  }, [matchID]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function take(seatId: number) {
    try {
      rememberName(name);
      const { playerCredentials } = await lobby.joinMatch(GAME_ID, matchID, { playerID: String(seatId), playerName: name });
      const s: Seat = { playerID: String(seatId), credentials: playerCredentials, name };
      saveSeat(matchID, s);
      setSeat(s);
      refresh();
    } catch {
      setError('Не удалось занять место (возможно, уже занято).');
    }
  }

  const shareUrl = `${location.origin}${location.pathname}#/m/${matchID}`;
  const joined = players?.filter((p) => p.name).length ?? 0;
  const total = players?.length ?? 0;

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (seat) {
    return (
      <div className="room">
        <div className="room-bar">
          <a href="#/" className="back">← выход</a>
          <span>Код: <b>{matchID}</b></span>
          <button onClick={copyLink}>{copied ? 'Скопировано!' : 'Скопировать ссылку'}</button>
          <span className="joined">Игроки: {joined}/{total}</span>
        </div>
        <NetClient matchID={matchID} playerID={seat.playerID} credentials={seat.credentials} />
      </div>
    );
  }

  return (
    <Page title="Сбор за столом" subtitle={`Комната ${matchID} — займите место.`}>
      {error && <div className="err">{error}</div>}
      <section className="page-card">
        <h2>Места</h2>
        <label>Ваше имя
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </label>
        <div className="seat-list">
          {players?.map((p) => (
            <div key={p.id} className={`seat ${p.name ? 'taken' : ''}`}>
              <span className="seat-num">{p.id + 1}</span>
              <span className="seat-name">{p.name ? <b>{p.name}</b> : <i>свободно</i>}</span>
              {!p.name && <button className="btn small" onClick={() => take(p.id)}>Занять</button>}
            </div>
          ))}
          {!players && <div className="page-note">Загрузка…</div>}
        </div>
      </section>
      <section className="page-card">
        <h2>Позвать друзей</h2>
        <div className="share"><code>{shareUrl}</code></div>
        <button className="btn ghost" onClick={copyLink}>{copied ? 'Скопировано!' : 'Скопировать ссылку'}</button>
      </section>
      <a className="page-link" href="#/">← На главную</a>
    </Page>
  );
}
