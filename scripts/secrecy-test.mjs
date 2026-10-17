// Проверка скрытой информации по сети: в WebSocket-кадрах игрока B не должно быть
// ни одной карты, кроме его собственной руки (ни чужой руки, ни колоды).
// node scripts/secrecy-test.mjs http://localhost:3001
import puppeteer from 'puppeteer';
import fs from 'fs';

const base = process.argv[2] ?? 'http://localhost:3001';
const catalog = JSON.parse(fs.readFileSync(new URL('../packages/engine/src/data/cards.json', import.meta.url), 'utf-8'));
const ALL = catalog.cards.map((c) => c.id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const click = (page, sel, text) => page.evaluate((sel, text) => {
  const el = [...document.querySelectorAll(sel)].find((e) => !text || e.textContent.includes(text));
  if (el) el.click();
  return !!el;
}, sel, text);

const a = await browser.newPage();
await a.goto(base, { waitUntil: 'networkidle0' });
await a.evaluate(() => document.querySelectorAll('.page-count button')[0].click()); // 2 игрока
await click(a, 'button', 'Создать игру');
await a.waitForFunction(() => location.hash.startsWith('#/m/'));
const matchID = await a.evaluate(() => location.hash.replace('#/m/', ''));

const ctxB = await browser.createBrowserContext();
const b = await ctxB.newPage();
const frames = [];
const cdp = await b.createCDPSession();
await cdp.send('Network.enable');
cdp.on('Network.webSocketFrameReceived', (e) => frames.push(e.response.payloadData));
await b.goto(`${base}#/m/${matchID}`, { waitUntil: 'networkidle0' });
await b.waitForSelector('.seat-list');
await click(b, 'button', 'Занять');
await b.waitForSelector('.swatch');
await sleep(500);
await a.evaluate(() => document.querySelectorAll('.seat')[0].querySelectorAll('.swatch')[0].click());
await sleep(300);
await b.evaluate(() => document.querySelectorAll('.seat')[1].querySelectorAll('.swatch')[3].click());
await sleep(500);
await click(a, 'button', 'Начать игру');
await b.waitForSelector('.board', { timeout: 10000 });
await sleep(1500);

await click(b, '.hand-toggle'); // рука — выдвижная панель, по умолчанию закрыта
await sleep(300);
const myHand = await b.evaluate(() => [...document.querySelectorAll('.hand-card img')].map((i) => i.src.split('/').pop().replace('.webp', '')));
const text = frames.join('\n');
const leaked = ALL.filter((id) => !myHand.includes(id) && new RegExp(`"${id}"`).test(text));
console.log('рука B:', myHand.join(', '));
console.log('кадров получено:', frames.length, '· своих карт в кадрах:', myHand.filter((id) => text.includes(`"${id}"`)).length);
console.log(leaked.length ? `УТЕЧКА: ${leaked.join(', ')}` : 'утечек нет: чужих карт и колоды в кадрах B нет');
await browser.close();
process.exit(leaked.length ? 1 : 0);
