// Прогон хотсита в браузере: лобби → стол → розыгрыш карты → ручной режим → победа.
// node scripts/hotseat-test.mjs http://localhost:3001 <префикс скриншотов>
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://localhost:3001';
const out = process.argv[3] ?? 'hotseat';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (sel, text) => {
  const ok = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => !text || e.textContent.includes(text));
    if (!el || el.disabled) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, sel, text);
  await sleep(120);
  return ok;
};

await page.goto(base + '/#/local', { waitUntil: 'networkidle0' });
await click('.page-count button', '2');
await click('button', 'Начать');
await page.waitForSelector('.swatch');
await page.evaluate(() => document.querySelectorAll('.seat')[0].querySelectorAll('.swatch')[0].click());
await sleep(150);
await page.evaluate(() => document.querySelectorAll('.seat')[1].querySelectorAll('.swatch')[3].click());
await sleep(150);
await click('button', 'Начать игру');
await page.waitForSelector('.board');
await sleep(1200);
await page.screenshot({ path: `${out}-1.png` });

/** Открыть руку (выдвижная панель) и сыграть первую карту. */
async function playFirst() {
  if (!(await page.$('.hand-card'))) await click('.hand-toggle');
  await click('.hand-card');
}

/** Доиграть текущую карту, нажимая «пропустить»-подобные кнопки. */
async function finishCard() {
  for (let i = 0; i < 10; i++) {
    if (await click('.prompt-bar button', 'Пропустить')) continue;
    if (await click('.prompt-bar button', 'Готово')) continue;
    if (await click('.action button', 'Тянуть событие')) continue;
    if (await click('.action button', 'Готово')) continue;
    if (await click('.action button', 'Пропустить')) continue;
    if (await click('.action button', 'Взять $')) continue;
    if (await click('.action button', 'Можно сыграть ещё карту')) continue;
    break;
  }
}

await playFirst();
await page.screenshot({ path: `${out}-2.png` });
await finishCard();

// Ручной режим: беспорядки в 8 районах, слуги текущего игрока везде, деньги всем.
await click('.manual button', 'Ручной режим');
const polys = await page.$$('.area');
for (let k = 0; k < polys.length; k++) {
  await page.evaluate((k) => document.querySelectorAll('.area')[k].dispatchEvent(new MouseEvent('click', { bubbles: true })), k);
  await sleep(120);
  if (k < 8) await click('.popup-box button', 'Положить');
  await page.evaluate(() => document.querySelectorAll('.popup-box .manual-row')[1].querySelectorAll('button')[0].click());
  await sleep(100);
  if (k === 0) await page.screenshot({ path: `${out}-3.png` });
  await click('.popup-box button', 'Закрыть');
}
for (const pidx of [0, 1]) {
  await page.evaluate((pidx) => {
    const [from, to] = document.querySelectorAll('.manual-row select');
    from.value = 'bank'; from.dispatchEvent(new Event('change', { bubbles: true }));
    to.value = String(pidx); to.dispatchEvent(new Event('change', { bubbles: true }));
    const amt = document.querySelector('.manual-row input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(amt, '60'); amt.dispatchEvent(new Event('input', { bubbles: true }));
  }, pidx);
  await sleep(100);
  await click('.manual-row button', 'Перевести');
}
await page.screenshot({ path: `${out}-4.png` });
await click('.manual button', 'Выйти');

// Передаём ходы, пока кто-то не победит.
for (let t = 0; t < 6 && !(await page.$('.gameover')); t++) {
  await click('.action button', 'Закончить ход');
  await sleep(300);
  if (await page.$('.gameover')) break;
  await playFirst();
  await finishCard();
}
// Победа по личности зависит от раздачи (например, у Ваймса её нет) — тогда объявляем конец вручную.
if (!(await page.$('.gameover'))) {
  page.on('dialog', (d) => d.accept());
  if (!(await page.$('.manual.on'))) await click('.manual button', 'Ручной режим');
  await click('.manual-row .btn', 'Закончить игру');
}
await sleep(500);
await page.screenshot({ path: `${out}-5.png` });
const result = await page.evaluate(() => ({
  gameover: document.querySelector('.gameover')?.innerText ?? null,
  log: [...document.querySelectorAll('.log div')].slice(0, 6).map((d) => d.textContent),
}));
console.log(JSON.stringify(result, null, 1));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await browser.close();
