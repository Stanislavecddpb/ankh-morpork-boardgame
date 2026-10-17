import { useEffect, useState } from 'react';
import { Home } from './Home';
import { GameRoom } from './GameRoom';
import { LocalGame } from './LocalGame';
import { AreaEditor } from './dev/AreaEditor';

function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  const match = hash.match(/^#\/m\/(.+)$/);
  if (match) return <GameRoom matchID={match[1]} />;
  if (hash === '#/local') return <LocalGame />;
  if (hash === '#/dev/areas') return <AreaEditor />;
  return <Home />;
}
