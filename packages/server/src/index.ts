import path from 'path';
import serve from 'koa-static';
import { Server } from 'boardgame.io/server';
import { AnkhMorporkGame } from '@am/engine';

const PORT = Number(process.env.PORT ?? 3001);

// Любой источник: сервер раздаёт и клиент, и сокеты, а за туннелем (ngrok) домен произвольный.
const server = Server({
  games: [AnkhMorporkGame],
  origins: [/.*/],
});

// Собранный клиент с того же порта → для игры по сети достаточно одного туннеля.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
server.app.use(serve(CLIENT_DIST));

server.run(PORT, () => {
  console.log(`Анк-Морпорк: http://localhost:${PORT}  (клиент + сервер на одном порту)`);
});
