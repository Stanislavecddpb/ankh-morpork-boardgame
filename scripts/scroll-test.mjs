// Хотсит на 3 игрока: бот играет карты и отвечает на вопросы свитков через интерфейс.
// Снимает скриншот первого вопроса каждого вида и собирает ошибки страницы.
// node scripts/scroll-test.mjs http://localhost:3001 <префикс скриншотов> [шагов]
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://localhost:3001';
const out = process.argv[3] ?? 'scroll';
const steps = Number(process.argv[4] ?? 400);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Кликнуть первый элемент sel (с текстом text), если он есть и активен. */
const click = (sel, text) => page.evaluate((sel, text) => {
  const el = [...document.querySelectorAll(sel)].find((e) => (!text || e.textContent.includes(text)) && !e.disabled);
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, sel, text);

await page.goto(base + '/#/local', { waitUntil: 'networkidle0' });
await click('.page-count button', '3');
await click('button', 'Начать');
await page.waitForSelector('.swatch');
for (let i = 0; i < 3; i++) {
  await page.evaluate((i) => document.querySelectorAll('.seat')[i].querySelectorAll('.swatch')[i].click(), i);
  await sleep(120);
}
await click('button', 'Начать игру');
await page.waitForSelector('.board');

const seen = new Set();
const shot = async (kind) => {
  if (seen.has(kind)) return;
  seen.add(kind);
  await sleep(200);
  await page.screenshot({ path: `${out}-${kind}.png` });
};

for (let s = 0; s < steps; s++) {
  await sleep(60);
  if (await page.$('.gameover')) break;
  if (await click('.handoff button')) { await shot('handoff'); continue; }
  if (await page.$('.respond-box')) {
    await shot('respond');
    if (await page.$('.respond-body .hand-card')) {
      const need = await page.evaluate(() => {
        const t = document.querySelector('.respond-body h3')?.textContent ?? '';
        return Number(t.match(/(\d+) карт/)?.[1] ?? 1);
      });
      for (let i = 0; i < need; i++) await page.evaluate((i) => document.querySelectorAll('.respond-body .hand-card')[i]?.click(), i);
      await click('.respond-body > .btn');
    } else await click('.respond-body .btn');
    continue;
  }
  if (await page.$('.reveal-box')) {
    await shot('reveal');
    if (!(await click('.reveal-box .btn', 'Понятно'))) await click('.reveal-box .hand-card');
    continue;
  }
  const bar = await page.evaluate(() => document.querySelector('.prompt-bar')?.textContent ?? '');
  if (bar.includes('Выполнить')) { await click('.prompt-bar .btn', 'Выполнить'); continue; }
  if (await page.$('.prompt-bar .player-pick')) { await shot('player'); await click('.prompt-bar .player-pick'); continue; }
  if (bar.includes('выберите на поле')) {
    await shot('board');
    await page.evaluate(() => document.querySelector('.area.hl')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await sleep(100);
    if (await page.$('.popup-box')) await click('.popup-box .btn');
    continue;
  }
  if (await page.$('.hand-select')) {
    await shot('hand');
    const min = await page.evaluate(() => Number(document.querySelector('.hand-select')?.textContent.match(/из (\d+)/)?.[1] ?? 0));
    for (let i = 0; i < min; i++) await page.evaluate((i) => document.querySelectorAll('.hand .hand-card')[i]?.click(), i);
    await click('.hand-select .btn');
    continue;
  }
  if (bar && (await click('.prompt-bar .btn'))) continue; // вопрос-кнопки у текущего игрока
  // Обычные символы — пропускаем, событие тянем.
  if (await click('.action .btn', 'Тянуть событие')) continue;
  if (await click('.action .btn', 'Пропустить')) continue;
  if (await click('.action .btn', 'Взять $')) continue;
  if (await click('.action .btn', 'Можно сыграть ещё карту')) continue;
  if (await click('.action .btn', 'Готово')) continue;
  // Сыграть карту или закончить ход.
  if (!(await page.$('.hand .hand-card'))) await click('.hand-toggle');
  if (await click('.hand .hand-card')) continue;
  await click('.action .btn', 'Закончить ход');
}

const log = await page.evaluate(() => [...document.querySelectorAll('.log div')].slice(0, 8).map((d) => d.textContent));
console.log('виды вопросов:', [...seen].join(', ') || 'нет');
console.log('лог:', log.join(' | '));
console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'ошибок страницы нет');
await browser.close();
