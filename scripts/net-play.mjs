// Сетевая партия: N отдельных браузеров (свой localStorage у каждого) играют полную партию через сервер.
// Каждый игрок жмёт только на своём экране. Попутно:
//  - перезагрузка случайного игрока посреди партии (должен вернуться на своё место);
//  - двойные клики по кнопкам действий;
//  - сверка лога у всех игроков (рассинхрон);
//  - в каждом кадре WebSocket у игрока нет чужих рук, личностей и колоды.
// node scripts/net-play.mjs http://localhost:3001 [игроков=4] [шагов=3000] [префикс скриншотов]
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://localhost:3001';
const N = Number(process.argv[3] ?? 4);
const STEPS = Number(process.argv[4] ?? 3000);
const out = process.argv[5] ?? 'netplay';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const problems = [];
const problem = (t) => { if (!problems.includes(t)) { problems.push(t); console.log('ПРОБЛЕМА:', t); } };

/** Кликнуть первый активный элемент sel (с текстом text); twice — двойной клик. */
const click = (page, sel, text, twice = false) => page.evaluate((sel, text, twice) => {
  const el = [...document.querySelectorAll(sel)].find((e) => (!text || e.textContent.includes(text)) && !e.disabled);
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (twice) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, sel, text, twice);

// ——— Проверка кадров: чужие руки и личности скрыты, колода пуста ———
function checkFrame(pid, payload) {
  const i = payload.indexOf('[');
  if (i < 0) return;
  let data;
  try { data = JSON.parse(payload.slice(i)); } catch { return; }
  const seen = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (o.players && o.areas && Array.isArray(o.deck)) {
      if (o.gameover) return;
      if (o.deck.length) problem(`игроку ${pid} пришла колода`);
      if (o.events?.length) problem(`игроку ${pid} пришли события`);
      for (const [p, st] of Object.entries(o.players)) {
        if (p === pid) continue;
        if (st.hand?.some((c) => c !== '?')) problem(`игроку ${pid} пришла рука игрока ${p}`);
        if (st.personality) problem(`игроку ${pid} пришла личность игрока ${p}`);
      }
      return;
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(data);
}

async function openPlayer(k, url) {
  const ctx = k === 0 ? browser.defaultBrowserContext() : await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', (e) => problem(`ошибка страницы у игрока ${k}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived', (e) => checkFrame(String(k), e.response.payloadData));
  await page.goto(url, { waitUntil: 'networkidle0' });
  return page;
}

// ——— Сбор за столом ———
const pages = [];
pages[0] = await openPlayer(0, base);
await pages[0].evaluate((n) => [...document.querySelectorAll('.page-count button')].find((b) => b.textContent.trim() === String(n))?.click(), N);
await click(pages[0], 'button', 'Создать игру');
await pages[0].waitForFunction(() => location.hash.startsWith('#/m/'));
const matchID = await pages[0].evaluate(() => location.hash.replace('#/m/', ''));
for (let k = 1; k < N; k++) {
  pages[k] = await openPlayer(k, `${base}#/m/${matchID}`);
  await pages[k].waitForSelector('.seat-list');
  await pages[k].evaluate((name) => {
    const input = document.querySelector('.page-card input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, `Бот ${k + 1}`);
  await sleep(100);
  await click(pages[k], '.seat-list button', 'Занять');
  await pages[k].waitForSelector('.swatch', { timeout: 10000 });
}
await sleep(800);
// Цвет: по интернету первый клик сразу после входа может уйти до подключения — повторяем, пока не выбран.
for (let k = 0; k < N; k++) {
  for (let t = 0; t < 20 && !(await pages[k].$('.seat.me .swatch.on')); t++) {
    await pages[k].evaluate((k) => document.querySelector('.seat.me')?.querySelectorAll('.swatch')[k].click(), k);
    await sleep(500);
  }
}
// По интернету данные о местах и цветах доходят с задержкой: ждём, пока кнопка станет активной.
await pages[0].waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Начать игру') && !b.disabled), { timeout: 30000 })
  .catch(async () => { await pages[0].screenshot({ path: `${out}-lobby.png` }); throw new Error('хост не может начать игру — см. скриншот лобби'); });
await click(pages[0], 'button', 'Начать игру');
for (const p of pages) await p.waitForSelector('.board', { timeout: 30000 });
console.log(`партия ${matchID}: ${N} игроков`);

// Первый раз, когда игрок видит окно данного вида, — скриншот его экрана и экранов остальных.
const seen = new Set();
async function shotAll(kind) {
  if (seen.has(kind)) return;
  seen.add(kind);
  await sleep(300);
  for (let k = 0; k < pages.length; k++) await pages[k].screenshot({ path: `${out}-${kind}-${k}.png` });
}

// ——— Ход бота на экране одного игрока: true — что-то нажал ———
async function act(page, twice) {
  if (await page.$('.offer-box')) { await shotAll('offer'); return click(page, '.offer-box .respond-body .btn'); }
  if (await page.$('.respond-box')) {
    await shotAll('respond');
    if (await page.$('.respond-body .hand-card')) {
      const need = await page.evaluate(() => Number(document.querySelector('.respond-body h3')?.textContent.match(/(\d+) карт/)?.[1] ?? 1));
      for (let i = 0; i < need; i++) await page.evaluate((i) => document.querySelectorAll('.respond-body .hand-card')[i]?.click(), i);
      return click(page, '.respond-body > .btn');
    }
    return click(page, '.respond-body .btn');
  }
  if (await page.$('.reveal-box')) return (await click(page, '.reveal-box .btn', 'Понятно')) || click(page, '.reveal-box .hand-card');
  const bar = await page.evaluate(() => document.querySelector('.prompt-bar')?.textContent ?? '');
  const waiting = bar.includes('Ждём ответа');
  if (!waiting) {
    if (bar.includes('Выполнить')) return click(page, '.prompt-bar .btn', 'Выполнить', twice);
    if (await page.$('.prompt-bar .player-pick')) return click(page, '.prompt-bar .player-pick');
    if (bar.includes('выберите на поле')) {
      await page.evaluate(() => document.querySelector('.area.hl')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await sleep(80);
      if (await page.$('.popup-box')) await click(page, '.popup-box .btn');
      return true;
    }
    if (await page.$('.hand-select')) {
      const min = await page.evaluate(() => Number(document.querySelector('.hand-select')?.textContent.match(/из (\d+)/)?.[1] ?? 0));
      for (let i = 0; i < min; i++) await page.evaluate((i) => document.querySelectorAll('.hand .hand-card')[i]?.click(), i);
      return click(page, '.hand-select .btn');
    }
    if (bar && (await click(page, '.prompt-bar .btn'))) return true;
  }
  if (!(await page.$('.action .btn:not(.ghost.undo)'))) return false; // не мой ход
  // Способность района: кнопка «Мои районы» светится, когда есть что применить.
  if (Math.random() < 0.2 && (await page.evaluate(() => [...document.querySelectorAll('.hand-toggle')].some((b) => b.classList.contains('glow'))))) {
    await click(page, '.hand-toggle', 'Мои районы');
    await sleep(200);
    if (await click(page, '.district-card .btn', 'Применить')) return true;
  }
  for (const t of ['Тянуть событие', 'Пропустить', 'Взять $', 'Можно сыграть ещё карту', 'Готово']) {
    if (await click(page, '.action .btn', t, twice)) return true;
  }
  if (!(await page.$('.hand .hand-card'))) await click(page, '.hand-toggle');
  if (await click(page, '.hand .hand-card')) return true;
  return click(page, '.action .btn', 'Закончить ход', twice);
}

const logOf = (page) => page.evaluate(() => [...document.querySelectorAll('.log div')].slice(0, 6).map((d) => d.textContent).join(' | '));

let idle = 0;
let reloads = 0;
let over = false;
for (let s = 0; s < STEPS && !over; s++) {
  let acted = false;
  for (let k = 0; k < N; k++) {
    if (await pages[k].$('.gameover')) { over = true; break; }
    if (await act(pages[k], Math.random() < 0.1)) { acted = true; await sleep(120); }
  }
  idle = acted ? 0 : idle + 1;
  if (idle > 40) {
    problem('партия застряла: никто не может походить');
    for (let k = 0; k < N; k++) await pages[k].screenshot({ path: `${out}-stuck-${k}.png` });
    break;
  }
  if (s > 0 && s % 60 === 0) {
    // Перезагрузка случайного игрока: должен вернуться за стол на своё место.
    const k = Math.floor(Math.random() * N);
    await pages[k].reload({ waitUntil: 'networkidle0' });
    try { await pages[k].waitForSelector('.board', { timeout: 10000 }); reloads++; }
    catch { problem(`игрок ${k} после перезагрузки не вернулся за стол`); }
  }
  if (s % 25 === 0) {
    await sleep(600);
    const logs = await Promise.all(pages.map(logOf));
    if (new Set(logs).size > 1) {
      await sleep(1500);
      const again = await Promise.all(pages.map(logOf));
      if (new Set(again).size > 1) problem(`рассинхрон лога: ${again.join(' ### ')}`);
    }
  }
}

await sleep(500);
const result = await pages[0].evaluate(() => document.querySelector('.gameover h2')?.textContent ?? null);
await pages[0].screenshot({ path: `${out}-end.png` });
console.log('итог:', result ?? 'не закончилась', `· перезагрузок: ${reloads}`);
console.log('лог:', await logOf(pages[0]));
console.log(problems.length ? `ПРОБЛЕМЫ (${problems.length}):\n` + problems.join('\n') : 'проблем нет');
await browser.close();
process.exit(problems.length || !result ? 1 : 0);
