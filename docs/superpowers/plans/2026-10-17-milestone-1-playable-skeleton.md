# Веха 1: играбельный каркас «Анк-Морпорка» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Партию «Анк-Морпорка» на 2–4 игрока можно сыграть по сети от начала до конца: лобби, поле, раздача, тайные личности, все базовые символы карт автоматически, тексты карт и события — вручную, отмена хода, победа и финальный подсчёт.

**Architecture:** npm-монорепо по образцу «Киклад» (`C:\Users\kosmy\Desktop\ancient-greece`): `packages/engine` (правила на boardgame.io, чистые функции + vitest), `packages/server` (Koa + socket.io, раздаёт клиент), `packages/client` (React + Vite). Картинки карт, поля и жетонов один раз вырезаются Python-скриптами из PDF в `packages/client/public`, каталог карт генерируется из таблицы перевода в `packages/engine/src/data/cards.json`.

**Tech Stack:** TypeScript 5.6, boardgame.io 0.50, React 18, Vite 5, vitest 2, Koa (через boardgame.io/server), Python 3 + pymupdf + openpyxl + Pillow, puppeteer (сетевой тест и скриншоты).

**Спецификация:** `docs/superpowers/specs/2026-10-17-ankh-morpork-design.md`

## Global Constraints

- Node 20 (`.node-version`); boardgame.io `^0.50.2`; react `^18.3.1`; vite `^5.4.0`; typescript `^5.6.0`; vitest `^2.1.0`.
- Игроков 2–4; цвета фишек: `red`, `yellow`, `green`, `blue`.
- Весь текст интерфейса и лога — на русском.
- Исходные материалы лежат в `source/` и никогда не коммитятся; в git — только сгенерированные веб-картинки.
- Десктопный браузер, ширина от 1366 px; мобильная вёрстка не нужна.
- Скрытая информация (чужие руки, личности, порядок колоды и событий) не уходит клиенту: всё через `playerView`.
- Ходы, которые открывают скрытое или используют случайность (взять событие, взять карту, добор в конце хода), объявляются как `{ move, client: false, undoable: false }`.
- Каждый коммит заканчивается строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Команды выполняются из корня `C:\Users\kosmy\Desktop\ankh-morpork` в Git Bash.

---

## Карта файлов

```
.gitignore, .node-version, package.json, tsconfig.base.json, render.yaml, README.md
source/                                  — исходники (в .gitignore)
tools/assets/requirements.txt
tools/assets/build_cards.py              — PDF карт → webp + cards.json
tools/assets/preview_print.py            — превью страниц для_распечатки.pdf
tools/assets/build_board.py              — склейка поля → board.webp
tools/assets/build_tokens.py             — жетоны → tokens/*.webp
tools/assets/board_layout.json           — раскладка фрагментов поля (данные)
tools/assets/tokens.json                 — рамки жетонов (данные)
packages/engine/src/
  types.ts            — типы состояния и константы
  data/cards.json     — сгенерированный каталог (не править руками)
  data/cards.ts       — типизированный доступ к каталогу
  data/areas.ts       — 12 районов: имя, цена, соседи
  helpers.ts          — лог, имена, добор карт
  setup.ts            — подготовка партии, выбор цвета
  rules.ts            — слуги, беспорядки, здания, убийство, контроль
  victory.ts          — условия победы, подсчёт очков
  turn.ts             — розыгрыш карты по символам, конец хода
  manual.ts           — ручные действия
  view.ts             — playerView и размеры скрытых колод
  game.ts             — определение игры boardgame.io
  index.ts
  *.test.ts
packages/server/src/index.ts
packages/client/
  index.html, vite.config.ts
  public/{board.webp, cards/, events/, personalities/, districts/, tokens/, fonts/}
  src/main.tsx, App.tsx, net.ts, Page.tsx, Home.tsx, GameRoom.tsx, LocalGame.tsx, styles.css
  src/table/assets.ts, areas.json, Table.tsx, Lobby.tsx, BoardView.tsx, Hand.tsx,
           ActionPanel.tsx, PlayersPanel.tsx, LogPanel.tsx, ManualPanel.tsx, GameOverPanel.tsx
  src/dev/AreaEditor.tsx
scripts/net-test.mjs, scripts/shot.mjs
```

---

### Task 1: Исходники в `source/` и каркас монорепо с пакетом движка

**Files:**
- Move: все исходные материалы из корня → `source/`
- Modify: `.gitignore`
- Create: `.node-version`, `package.json`, `tsconfig.base.json`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/types.ts`, `packages/engine/src/index.ts`, `packages/engine/src/types.test.ts`

**Interfaces:**
- Produces: пакет `@am/engine`; типы `PlayerID`, `AreaId`, `Color`, `COLORS`, `SymbolKind`, `CardSymbol`, `PersonalityId`, `AreaState`, `PlayerState`, `CardInPlay`, `GameOver`, `AMState`, `Target` и константы из `types.ts` (ниже). Все последующие задачи используют их ровно с этими именами.

- [ ] **Step 1: Перенести исходники**

```bash
mkdir -p source
mv 8723_Ankh-Morpork_Rules_small.pdf Discworld_FAQ_V2.pdf для_распечатки.pdf "Ankh-Morpork Discworld cardForge" "Ankh-Morpork Discworld final PDF cards ForPrint" FolkardCyr source/
ls source
```
Expected: 6 элементов в `source/`, в корне остались только `.git`, `.gitignore`, `docs`.

- [ ] **Step 2: Переписать `.gitignore`**

```gitignore
node_modules/
dist/
*.log
*.tsbuildinfo
.vite/

# Исходные материалы игры — в git не храним
source/

# Превью и временные скриншоты
tools/assets/preview/
/*.png
```

- [ ] **Step 3: Корневые файлы**

`.node-version`:
```
20
```

`package.json`:
```json
{
  "name": "ankh-morpork",
  "version": "0.0.1",
  "private": true,
  "description": "Браузерная версия настольной игры «Плоский мир: Анк-Морпорк»",
  "workspaces": [
    "packages/engine"
  ],
  "scripts": {
    "build": "npm run build -w packages/engine && npm run build -w packages/server && npm run build -w packages/client",
    "start": "npm run serve",
    "dev:server": "npm run dev -w packages/server",
    "dev:client": "npm run dev -w packages/client",
    "serve": "npm run start -w packages/server",
    "play": "npm run build -w packages/client && npm run serve",
    "test": "npm run test -w packages/engine"
  },
  "devDependencies": {
    "puppeteer": "^25.1.0"
  }
}
```
`packages/server` и `packages/client` добавляются в `workspaces` в Task 8, когда эти пакеты появятся.

`tsconfig.base.json` — скопировать из «Киклад» без изменений:
```bash
cp ../ancient-greece/tsconfig.base.json .
```

- [ ] **Step 4: Пакет движка**

`packages/engine/package.json`:
```json
{
  "name": "@am/engine",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "boardgame.io": "^0.50.2"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "src/**/*.json"]
}
```

- [ ] **Step 5: Написать падающий тест на типы и константы**

`packages/engine/src/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { COLORS, HAND_SIZE, MINIONS_PER_PLAYER, BUILDINGS_PER_PLAYER, START_MONEY } from './types';

describe('константы', () => {
  it('соответствуют правилам', () => {
    expect(COLORS).toEqual(['red', 'yellow', 'green', 'blue']);
    expect(HAND_SIZE).toBe(5);
    expect(MINIONS_PER_PLAYER).toBe(12);
    expect(BUILDINGS_PER_PLAYER).toBe(6);
    expect(START_MONEY).toBe(10);
  });
});
```

- [ ] **Step 6: Установить зависимости и убедиться, что тест падает**

```bash
npm install
npm test
```
Expected: FAIL — `Failed to resolve import "./types"`.

- [ ] **Step 7: Написать `types.ts` и `index.ts`**

`packages/engine/src/types.ts`:
```ts
export type PlayerID = string;
/** Номер района на поле: 1..12. */
export type AreaId = number;

export type Color = 'red' | 'yellow' | 'green' | 'blue';
export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

/** Символы в верхней части игровой карты. */
export type SymbolKind =
  | 'minion' // поставить слугу
  | 'building' // построить здание
  | 'assassinate' // убийство
  | 'removeTrouble' // убрать жетон беспорядка
  | 'money' // взять деньги из банка (amount)
  | 'scroll' // текст карты
  | 'event' // случайное событие (обязательно)
  | 'playAnother' // сыграть ещё одну карту
  | 'interrupt'; // прерывание

export interface CardSymbol {
  kind: SymbolKind;
  amount?: number;
}

export type PersonalityId =
  | 'lord-vetinari'
  | 'commander-vimes'
  | 'dragon-king-of-arms'
  | 'chrysoprase'
  | 'lord-selachii'
  | 'lord-rust'
  | 'lord-de-worde';

export interface AreaState {
  /** Слуги по игрокам (ключ есть у каждого игрока, 0 — нет слуг). */
  minions: Record<PlayerID, number>;
  building: PlayerID | null;
  trouble: boolean;
  demons: number;
  trolls: number;
}

export interface PlayerState {
  name: string;
  color: Color | null;
  money: number;
  /** Число непогашенных займов (Банк, Мистер Бент): −$12 к состоянию каждый. */
  loans: number;
  hand: string[];
  personality: PersonalityId | null;
  minionSupply: number;
  buildingSupply: number;
}

/** Карта, которую сейчас разыгрывают: оставшиеся символы слева направо. */
export interface CardInPlay {
  cardId: string;
  queue: CardSymbol[];
}

export interface GameOver {
  winner: PlayerID | null;
  reason: 'personality' | 'vimes' | 'score';
  personalities: Record<PlayerID, PersonalityId>;
  scores?: Record<PlayerID, number>;
}

export interface AMState {
  started: boolean;
  /** Позиция первого игрока в ctx.playOrder. */
  startIndex: number;
  areas: Record<AreaId, AreaState>;
  players: Record<PlayerID, PlayerState>;
  /** Игровая колода, deck[0] — верхняя карта. */
  deck: string[];
  discard: string[];
  /** Колода случайных событий, events[0] — верхняя. */
  events: string[];
  /** Событие, вытянутое в этом ходу (его эффект выполняется вручную). */
  lastEvent: string | null;
  play: CardInPlay | null;
  /** Сколько ещё карт можно сыграть в этом ходу. */
  playsLeft: number;
  cardsPlayed: number;
  log: string[];
  gameover: GameOver | null;
  /** Только в playerView: размеры скрытых колод. */
  deckCount?: number;
  eventsCount?: number;
}

/** Цель убийства в районе. */
export type Target = { kind: 'minion'; owner: PlayerID } | { kind: 'demon' } | { kind: 'troll' };

export const HAND_SIZE = 5;
export const MINIONS_PER_PLAYER = 12;
export const BUILDINGS_PER_PLAYER = 6;
export const START_MONEY = 10;
export const MAX_DEMONS = 4;
export const MAX_TROLLS = 3;
export const LOAN_REPAY = 12;
export const UNPAID_LOAN_PENALTY = 15;
```

`packages/engine/src/index.ts`:
```ts
export * from './types';
```

- [ ] **Step 8: Тест проходит**

```bash
npm test
```
Expected: PASS, 1 test.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .node-version package.json package-lock.json tsconfig.base.json packages/engine
git commit -m "Каркас монорепо и типы движка

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Вырезка карт и генерация каталога

**Files:**
- Create: `tools/assets/requirements.txt`, `tools/assets/build_cards.py`, `packages/engine/src/data/cards.json` (генерируется), `packages/engine/src/data/cards.ts`, `packages/engine/src/data/cards.test.ts`, `packages/client/public/{cards,events,personalities,districts}/*.webp` (генерируются)

**Interfaces:**
- Consumes: `CardSymbol`, `PersonalityId` из `types.ts`.
- Produces:
  - Картинки: `cards/green/<id>.webp`, `cards/brown/<id>.webp`, `cards/back-play.webp`, `events/<id>.webp`, `events/back.webp`, `personalities/<id>.webp`, `personalities/back.webp`, `districts/<1..12>.webp`, `districts/back.webp` (относительно `packages/client/public/`).
  - `cards.ts`: `CardDef { id; deck: 'green'|'brown'; name; nameEn; symbols: CardSymbol[] }`, `NamedDef { id; name }`, `CARDS: CardDef[]`, `CARD_BY_ID`, `PERSONALITIES: { id: PersonalityId; name }[]`, `PERSONALITY_BY_ID`, `EVENTS: NamedDef[]`, `EVENT_BY_ID`, `TWO_PLAYER_REMOVED_CARDS = ['hubert', 'cosmo-lavish']`, `TWO_PLAYER_REMOVED_PERSONALITY = 'chrysoprase'`.
  - id карты = slug английского названия: нижний регистр, апострофы/точки/скобки/кавычки удаляются, прочие не-буквоцифры → `-`. Примеры: `moist-von-lipwig`, `cmot-dibbler`, `herennow`, `dean-of-pentacles`, `bursar`, `the-peeled-nuts`.

Таблица перевода (`source/Ankh-Morpork Discworld cardForge/Ankh-Morpork Translation sheet.xlsx`, первый лист): колонки по индексу 0..14 — `0` комментарий, `1` «Как должно быть», `2` English, `3` «ОК», `4` русский перевод, `5` тип карточки, `10` число символов, `11..14` символы слева направо. Итоговое русское имя: если колонка 3 непуста → колонка 4, иначе колонка 1, иначе колонка 2. Типы: `Зелёные карты`, `Рыжие карты`, `Персонажи`, `Районы`, `случайные события`. Символы: `Агент`→minion, `Дом`→building, `Череп`→assassinate, `Значок`→removeTrouble, `Текст`→scroll, `Магия`→event, `Продолжить`→playAnother, `Рука`→interrupt, `N бакс/бакса/баксов`→money с amount N. «The Peeled Nuts» — карта-пустышка без символов (так в оригинале).

- [ ] **Step 1: Зависимости Python**

`tools/assets/requirements.txt`:
```
pymupdf>=1.24
openpyxl>=3.1
Pillow>=10.0
```
```bash
python -m pip install -r tools/assets/requirements.txt
```

- [ ] **Step 2: Написать падающий тест каталога**

`packages/engine/src/data/cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CARDS, CARD_BY_ID, PERSONALITIES, EVENTS } from './cards';

const KINDS = ['minion', 'building', 'assassinate', 'removeTrouble', 'money', 'scroll', 'event', 'playAnother', 'interrupt'];

describe('каталог карт', () => {
  it('48 зелёных и 53 коричневые, id уникальны', () => {
    expect(CARDS.filter((c) => c.deck === 'green')).toHaveLength(48);
    expect(CARDS.filter((c) => c.deck === 'brown')).toHaveLength(53);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(101);
  });

  it('7 личностей и 12 событий', () => {
    expect(PERSONALITIES.map((p) => p.id).sort()).toEqual([
      'chrysoprase', 'commander-vimes', 'dragon-king-of-arms', 'lord-de-worde', 'lord-rust', 'lord-selachii', 'lord-vetinari',
    ]);
    expect(EVENTS).toHaveLength(12);
  });

  it('символы корректны; у денег есть сумма', () => {
    for (const c of CARDS) {
      for (const s of c.symbols) {
        expect(KINDS).toContain(s.kind);
        if (s.kind === 'money') expect(s.amount).toBeGreaterThan(0);
      }
    }
  });

  it('примеры карт совпадают с оригиналом', () => {
    expect(CARD_BY_ID['moist-von-lipwig'].symbols).toEqual([
      { kind: 'minion' }, { kind: 'money', amount: 3 }, { kind: 'scroll' }, { kind: 'playAnother' },
    ]);
    expect(CARD_BY_ID['hello'].symbols.map((s) => s.kind)).toEqual(['assassinate', 'assassinate', 'building']);
    expect(CARD_BY_ID['the-peeled-nuts'].symbols).toEqual([]);
    expect(CARD_BY_ID['rincewind'].symbols.map((s) => s.kind)).toEqual(['event', 'scroll', 'playAnother']);
  });
});
```

- [ ] **Step 3: Тест падает**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./cards"`.

- [ ] **Step 4: Написать `build_cards.py`**

`tools/assets/build_cards.py`:
```python
"""Вырезает карты из PDF «ForPrint» в WebP и генерирует каталог для движка.

Запуск из корня репозитория: python tools/assets/build_cards.py
"""
import json
import re
import sys
from pathlib import Path

import openpyxl
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'source'
PDF = SRC / 'Ankh-Morpork Discworld final PDF cards ForPrint' / 'ForPrint'
XLSX = SRC / 'Ankh-Morpork Discworld cardForge' / 'Ankh-Morpork Translation sheet.xlsx'
PUBLIC = ROOT / 'packages' / 'client' / 'public'
OUT_JSON = ROOT / 'packages' / 'engine' / 'src' / 'data' / 'cards.json'
DPI = 150

FOLDERS = {
    'Зелёные карты': ('Playcards/GreenDeck', 'cards/green'),
    'Рыжие карты': ('Playcards/OrangeDeck', 'cards/brown'),
    'Персонажи': ('Personalities deck', 'personalities'),
    'случайные события': ('Events', 'events'),
}
BACKS = {
    'Playcards/Playcards !_BACK.pdf': 'cards/back-play.webp',
    'Events/Events !_BACK.pdf': 'events/back.webp',
    'Personalities deck/Personalities !_BACK.pdf': 'personalities/back.webp',
    'Districts/Districts !_BACK.pdf': 'districts/back.webp',
}
SYMBOLS = {
    'Агент': 'minion', 'Дом': 'building', 'Череп': 'assassinate', 'Значок': 'removeTrouble',
    'Текст': 'scroll', 'Магия': 'event', 'Продолжить': 'playAnother', 'Рука': 'interrupt',
}
# Английское имя в таблице → ключ имени файла (если они не совпадают).
ALIASES = {
    'Wallace Sonky': 'sonky',
    'Ankh-Morpork Sunshine Dragon Sanctuary': 'sunshinesanctuary',
    "Gimlet's Hole Food Delicatessen": 'delicatessen',
    "Harga's house of ribs": 'hargas',
    'Mr. Pin and Mr. Tulip': 'mrpinmrtulip',
    'The Royal Mint': 'royalmint',
    'Zorgo the Retrophrenologist': 'zorgo',
    'Captain Carrot': 'cataincarrot',
    'Dragon King of Arms': 'dragon',
    'Commander Vimes': 'vimes',
    'Lord Vetinari': 'vetinari',
    'Archchancellor Ridcully': 'ridcully',
    'Clack Towers': 'clacks',
    'Dean (of Pentacles)': 'dean',
    'Lecturer in recent runes': 'lecturer',
    'The Mob': 'mob',
    'Bloody stupid Johnson': 'johnson',
    'Demons from Dungeon Dimensions': 'demons',
    'Earthquake': 'quake',
    'Mysterious Murders': 'murders',
    'The Dragon': 'dragon',
}


def key(s: str) -> str:
    return re.sub(r'[^a-z]', '', s.lower())


def slug(s: str) -> str:
    s = re.sub(r"['\".()]", '', s.lower().strip())
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def file_key(stem: str) -> str:
    stem = re.sub(r'^(Districts|Events|Personalities)\s+', '', stem)
    stem = re.sub(r'^\d+\s+', '', stem)
    return key(stem)


def render(pdf: Path, out: Path) -> None:
    page = pymupdf.open(pdf)[0]
    pix = page.get_pixmap(dpi=DPI)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=85)


def parse_symbol(raw: str) -> dict:
    raw = raw.strip()
    m = re.match(r'(\d+)\s*бакс', raw)
    if m:
        return {'kind': 'money', 'amount': int(m.group(1))}
    return {'kind': SYMBOLS[raw]}


def main() -> None:
    ws = openpyxl.load_workbook(XLSX).worksheets[0]
    catalog = {'cards': [], 'personalities': [], 'events': []}
    used: set[Path] = set()

    for row in ws.iter_rows(min_row=2, values_only=True):
        en, kind = row[2], row[5]
        if not en or kind not in FOLDERS:
            continue
        name = (row[4] if row[3] else row[1] or en).strip()
        folder, out_dir = FOLDERS[kind]
        want = ALIASES.get(en, key(en))
        files = [f for f in (PDF / folder).glob('*.pdf') if 'BACK' not in f.name and file_key(f.stem) == want]
        if len(files) != 1:
            sys.exit(f'Не найден PDF для «{en}» в {folder}: {files}')
        cid = slug(en)
        render(files[0], PUBLIC / out_dir / f'{cid}.webp')
        used.add(files[0])
        if kind in ('Зелёные карты', 'Рыжие карты'):
            symbols = [parse_symbol(s) for s in row[11:15] if s]
            catalog['cards'].append({
                'id': cid, 'deck': 'green' if kind == 'Зелёные карты' else 'brown',
                'name': name, 'nameEn': en.strip(), 'symbols': symbols,
            })
        elif kind == 'Персонажи':
            catalog['personalities'].append({'id': cid, 'name': name})
        else:
            catalog['events'].append({'id': cid, 'name': name})

    for f in sorted((PDF / 'Districts').glob('Districts [0-9]*.pdf')):
        if f.stem.endswith(' '):
            continue  # дубль «Seven Sleepers .pdf»
        n = int(f.stem.split()[1])
        render(f, PUBLIC / 'districts' / f'{n}.webp')

    for src, out in BACKS.items():
        render(PDF / src, PUBLIC / out)

    green = sum(c['deck'] == 'green' for c in catalog['cards'])
    brown = sum(c['deck'] == 'brown' for c in catalog['cards'])
    districts = len(list((PUBLIC / 'districts').glob('[0-9]*.webp')))
    print(f'green={green} brown={brown} personalities={len(catalog["personalities"])} '
          f'events={len(catalog["events"])} districts={districts}')
    assert (green, brown, len(catalog['personalities']), len(catalog['events']), districts) == (48, 53, 7, 12, 12)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: Запустить скрипт**

```bash
PYTHONIOENCODING=utf-8 python tools/assets/build_cards.py
```
Expected: `green=48 brown=53 personalities=7 events=12 districts=12`, без исключений. Проверить `du -sh packages/client/public` — порядка 5–10 МБ.

- [ ] **Step 6: Написать `cards.ts`**

`packages/engine/src/data/cards.ts`:
```ts
import data from './cards.json';
import type { CardSymbol, PersonalityId } from '../types';

export interface CardDef {
  id: string;
  deck: 'green' | 'brown';
  name: string;
  nameEn: string;
  symbols: CardSymbol[];
}

export interface NamedDef {
  id: string;
  name: string;
}

export const CARDS: CardDef[] = data.cards as CardDef[];
export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const PERSONALITIES = data.personalities as { id: PersonalityId; name: string }[];
export const PERSONALITY_BY_ID = Object.fromEntries(PERSONALITIES.map((p) => [p.id, p])) as Record<PersonalityId, { id: PersonalityId; name: string }>;

export const EVENTS: NamedDef[] = data.events;
export const EVENT_BY_ID: Record<string, NamedDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Правило игры вдвоём. */
export const TWO_PLAYER_REMOVED_CARDS = ['hubert', 'cosmo-lavish'];
export const TWO_PLAYER_REMOVED_PERSONALITY: PersonalityId = 'chrysoprase';
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './data/cards';
```

- [ ] **Step 7: Тест проходит**

```bash
npm test
```
Expected: PASS (5 tests). Если `hello` или другой id не найден, сверить slug с `cards.json` и поправить тест под фактический id, а не скрипт.

- [ ] **Step 8: Commit**

```bash
git add tools/assets/requirements.txt tools/assets/build_cards.py packages/engine/src/data packages/engine/src/index.ts packages/client/public
git commit -m "Вырезка карт из PDF и каталог карт из таблицы перевода

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Районы, подготовка партии и выбор цвета

**Files:**
- Create: `packages/engine/src/data/areas.ts`, `packages/engine/src/helpers.ts`, `packages/engine/src/setup.ts`, `packages/engine/src/setup.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `types.ts`, `data/cards.ts`.
- Produces:
  - `AreaDef { id: AreaId; name: string; cost: number; adjacent: AreaId[] }`, `AREAS: AreaDef[]` (индекс = id − 1), `AREA_IDS: AreaId[]`, `areaDef(id): AreaDef`, `START_AREAS = [1, 5, 7]`.
  - `log(G, text): void`, `nameOf(G, pid): string`, `drawCards(G, pid, n): number` (сколько реально взято).
  - `type Shuffle = <T>(arr: T[]) => T[]`, `setupGame(numPlayers: number, shuffle: Shuffle): AMState`, `applySetColor(G, actor: PlayerID, target: PlayerID, color: string): string | null`, `applySetName(G, pid, name: string): string | null`.
  - Соглашение: функции движка, меняющие состояние, возвращают `string` (текст ошибки) или `null` (успех).

Соседство районов (общая граница или мост; проверяется визуально в Task 9):
1: 2, 3, 12 · 2: 1, 3, 4, 10, 11, 12 · 3: 1, 2, 4 · 4: 2, 3, 5, 6, 10 · 5: 4, 6, 7, 10 · 6: 4, 5, 7 · 7: 5, 6, 8, 10 · 8: 7, 9, 10 · 9: 8, 10, 11 · 10: 2, 4, 5, 7, 8, 9, 11 · 11: 2, 9, 10, 12 · 12: 1, 2, 11.

Цены (по картам районов): 1 — $6, 2 — $18, 3 — $12, 4 — $18, 5 — $6, 6 — $12, 7 — $6, 8 — $6, 9 — $12, 10 — $12, 11 — $18, 12 — $12.

- [ ] **Step 1: Написать падающие тесты**

`packages/engine/src/setup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { AREAS, START_AREAS } from './data/areas';
import { CARD_BY_ID } from './data/cards';
import { setupGame, applySetColor } from './setup';

const keep = <T,>(a: T[]) => [...a];

describe('районы', () => {
  it('12 районов, соседство симметрично и без петель', () => {
    expect(AREAS).toHaveLength(12);
    AREAS.forEach((a, i) => expect(a.id).toBe(i + 1));
    for (const a of AREAS) {
      expect(a.adjacent).not.toContain(a.id);
      for (const n of a.adjacent) expect(AREAS[n - 1].adjacent).toContain(a.id);
    }
  });
});

describe('подготовка', () => {
  it('4 игрока: 5 карт, $10, запас, по слуге и беспорядку в стартовых районах', () => {
    const G = setupGame(4, keep);
    for (const p of Object.values(G.players)) {
      expect(p.hand).toHaveLength(5);
      expect(p.money).toBe(10);
      expect(p.minionSupply).toBe(9);
      expect(p.buildingSupply).toBe(6);
      expect(p.personality).not.toBeNull();
      expect(p.color).toBeNull();
    }
    for (const a of START_AREAS) {
      expect(G.areas[a].trouble).toBe(true);
      for (const pid of ['0', '1', '2', '3']) expect(G.areas[a].minions[pid]).toBe(1);
    }
    expect(G.deck).toHaveLength(101 - 20);
    expect(G.events).toHaveLength(12);
    expect(G.started).toBe(false);
  });

  it('зелёные карты лежат поверх коричневых', () => {
    const G = setupGame(2, keep);
    const decks = G.deck.map((id) => CARD_BY_ID[id].deck);
    const firstBrown = decks.indexOf('brown');
    expect(decks.slice(0, firstBrown).every((d) => d === 'green')).toBe(true);
    expect(decks.slice(firstBrown).every((d) => d === 'brown')).toBe(true);
  });

  it('вдвоём: нет Хризопраза, Хьюберта и Космо', () => {
    const G = setupGame(2, keep);
    const all = [...G.deck, ...G.players['0'].hand, ...G.players['1'].hand];
    expect(all).toHaveLength(99);
    expect(all).not.toContain('hubert');
    expect(all).not.toContain('cosmo-lavish');
    expect(Object.values(G.players).map((p) => p.personality)).not.toContain('chrysoprase');
  });

  it('личности у всех разные', () => {
    const G = setupGame(4, keep);
    const ps = Object.values(G.players).map((p) => p.personality);
    expect(new Set(ps).size).toBe(4);
  });
});

describe('выбор цвета', () => {
  it('свой цвет — любой игрок, чужой — только хост, занятый — нельзя', () => {
    const G = setupGame(3, keep);
    expect(applySetColor(G, '1', '1', 'red')).toBeNull();
    expect(G.players['1'].color).toBe('red');
    expect(applySetColor(G, '2', '2', 'red')).not.toBeNull();
    expect(applySetColor(G, '2', '0', 'blue')).not.toBeNull();
    expect(applySetColor(G, '0', '2', 'blue')).toBeNull();
    expect(applySetColor(G, '0', '0', 'purple')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./data/areas"`.

- [ ] **Step 3: Реализация**

`packages/engine/src/data/areas.ts`:
```ts
import type { AreaId } from '../types';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Цена постройки здания. */
  cost: number;
  /** Соседние районы (общая граница или мост). */
  adjacent: AreaId[];
}

export const AREAS: AreaDef[] = [
  { id: 1, name: 'Сестры Долли', cost: 6, adjacent: [2, 3, 12] },
  { id: 2, name: 'Внедвижимость', cost: 18, adjacent: [1, 3, 4, 10, 11, 12] },
  { id: 3, name: 'Драконовы Руины', cost: 12, adjacent: [1, 2, 4] },
  { id: 4, name: 'Малых Богов', cost: 18, adjacent: [2, 3, 5, 6, 10] },
  { id: 5, name: 'Сточная улица', cost: 6, adjacent: [4, 6, 7, 10] },
  { id: 6, name: 'Гиппо', cost: 12, adjacent: [4, 5, 7] },
  { id: 7, name: 'Тени', cost: 6, adjacent: [5, 6, 8, 10] },
  { id: 8, name: 'Димуэлл', cost: 6, adjacent: [7, 9, 10] },
  { id: 9, name: 'Длинная Стена', cost: 12, adjacent: [8, 10, 11] },
  { id: 10, name: 'Остров Богов', cost: 12, adjacent: [2, 4, 5, 7, 8, 9, 11] },
  { id: 11, name: 'Семь Спящих', cost: 18, adjacent: [2, 9, 10, 12] },
  { id: 12, name: 'Нэп Хилл', cost: 12, adjacent: [1, 2, 11] },
];

export const AREA_IDS: AreaId[] = AREAS.map((a) => a.id);
export const areaDef = (id: AreaId): AreaDef => AREAS[id - 1];

/** Сестры Долли, Сточная улица, Тени: по слуге каждого игрока и жетону беспорядка. */
export const START_AREAS: AreaId[] = [1, 5, 7];
```

`packages/engine/src/helpers.ts`:
```ts
import type { AMState, PlayerID } from './types';

const LOG_LIMIT = 300;

export function log(G: AMState, text: string): void {
  G.log.push(text);
  if (G.log.length > LOG_LIMIT) G.log.splice(0, G.log.length - LOG_LIMIT);
}

export function nameOf(G: AMState, pid: PlayerID): string {
  return G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;
}

/** Берёт до n карт с верха колоды в руку. Возвращает, сколько взято. */
export function drawCards(G: AMState, pid: PlayerID, n: number): number {
  let taken = 0;
  while (taken < n && G.deck.length > 0) {
    G.players[pid].hand.push(G.deck.shift()!);
    taken++;
  }
  return taken;
}
```

`packages/engine/src/setup.ts`:
```ts
import type { AMState, AreaId, AreaState, Color, PlayerID, PlayerState } from './types';
import { BUILDINGS_PER_PLAYER, COLORS, HAND_SIZE, MINIONS_PER_PLAYER, START_MONEY } from './types';
import { AREA_IDS, START_AREAS } from './data/areas';
import { CARDS, EVENTS, PERSONALITIES, TWO_PLAYER_REMOVED_CARDS, TWO_PLAYER_REMOVED_PERSONALITY } from './data/cards';

export type Shuffle = <T>(arr: T[]) => T[];

function emptyArea(pids: PlayerID[]): AreaState {
  return { minions: Object.fromEntries(pids.map((p) => [p, 0])), building: null, trouble: false, demons: 0, trolls: 0 };
}

export function setupGame(numPlayers: number, shuffle: Shuffle): AMState {
  const pids = Array.from({ length: numPlayers }, (_, i) => String(i));
  const two = numPlayers === 2;

  const personalities = shuffle(
    PERSONALITIES.map((p) => p.id).filter((id) => !(two && id === TWO_PLAYER_REMOVED_PERSONALITY)),
  );
  const allowed = (id: string) => !(two && TWO_PLAYER_REMOVED_CARDS.includes(id));
  const green = shuffle(CARDS.filter((c) => c.deck === 'green' && allowed(c.id)).map((c) => c.id));
  const brown = shuffle(CARDS.filter((c) => c.deck === 'brown' && allowed(c.id)).map((c) => c.id));
  const deck = [...green, ...brown];

  const areas: Record<AreaId, AreaState> = {};
  for (const id of AREA_IDS) areas[id] = emptyArea(pids);
  for (const id of START_AREAS) {
    for (const pid of pids) areas[id].minions[pid] = 1;
    areas[id].trouble = true;
  }

  const players: Record<PlayerID, PlayerState> = {};
  pids.forEach((pid, i) => {
    players[pid] = {
      name: `Игрок ${i + 1}`,
      color: null,
      money: START_MONEY,
      loans: 0,
      hand: deck.splice(0, HAND_SIZE),
      personality: personalities[i],
      minionSupply: MINIONS_PER_PLAYER - START_AREAS.length,
      buildingSupply: BUILDINGS_PER_PLAYER,
    };
  });

  return {
    started: false,
    startIndex: 0,
    areas,
    players,
    deck,
    discard: [],
    events: shuffle(EVENTS.map((e) => e.id)),
    lastEvent: null,
    play: null,
    playsLeft: 0,
    cardsPlayed: 0,
    log: [],
    gameover: null,
  };
}

/** Свой цвет выбирает любой игрок, чужой — только хост ('0', нужен для хотсита). */
export function applySetColor(G: AMState, actor: PlayerID, target: PlayerID, color: string): string | null {
  if (!COLORS.includes(color as Color)) return 'Нет такого цвета';
  if (!G.players[target]) return 'Нет такого игрока';
  if (actor !== target && actor !== '0') return 'Чужой цвет может менять только хост';
  if (Object.entries(G.players).some(([pid, p]) => pid !== target && p.color === color)) return 'Цвет занят';
  G.players[target].color = color as Color;
  return null;
}

export function applySetName(G: AMState, pid: PlayerID, name: string): string | null {
  const n = String(name).trim().slice(0, 20);
  if (!G.players[pid] || !n) return 'Пустое имя';
  G.players[pid].name = n;
  return null;
}
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './data/areas';
export * from './helpers';
export * from './setup';
```

- [ ] **Step 4: Тесты проходят**

```bash
npm test
```
Expected: PASS (все тесты, включая 6 новых).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Районы, подготовка партии и выбор цвета

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Базовые правила поля

**Files:**
- Create: `packages/engine/src/rules.ts`, `packages/engine/src/rules.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `setupGame`, `AREAS`, `AREA_IDS`, `areaDef`, типы.
- Produces (все экспортируются из `rules.ts`):
  - `minionLikeCount(a: AreaState): number` — слуги всех игроков + демоны + тролли.
  - `areasWithMinionsOf(G, pid): AreaId[]`
  - `legalMinionAreas(G, pid): AreaId[]` — районы со своим слугой и соседние с ними, по возрастанию.
  - `placeMinion(G, pid, area, from?: AreaId): string | null` — если запас пуст, `from` обязателен (перестановка своего слуги).
  - `canBuildIn(G, pid, area): boolean`, `buildableAreas(G, pid): AreaId[]`, `buildIn(G, pid, area, from?: AreaId): string | null` — если все 6 зданий на поле, `from` — район своего здания для переноса.
  - `assassinationTargets(G, pid, area): Target[]`, `assassinationAreas(G, pid): AreaId[]`, `sameTarget(a, b): boolean`, `removeTarget(G, area, t): void`, `assassinate(G, pid, area, t): string | null`.
  - `troubleAreas(G): AreaId[]`, `troubleCount(G): number`, `removeTroubleIn(G, area): string | null`.
  - `piecesOf(a: AreaState, pid): number`, `controls(G, pid, area): boolean`.

Правила (из книги правил и FAQ):
- Беспорядок кладётся, когда слуга/демон/тролль входит в район, где уже есть хотя бы один слуга/демон/тролль (даже свой). Один жетон на район.
- Беспорядок снимается, когда из района уходит любой слуга/демон/тролль.
- Здание: свой слуга в районе, нет беспорядка, нет здания, хватает денег; строительство беспорядка не вызывает.
- Убийство: только в районе с беспорядком, только чужой слуга, демон или тролль.
- Контроль: (слуги + здание) игрока больше, чем у любого другого игрока по отдельности, больше числа троллей, и в районе нет демонов. Беспорядок на контроль не влияет.

- [ ] **Step 1: Написать падающие тесты**

`packages/engine/src/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import {
  legalMinionAreas, placeMinion, canBuildIn, buildIn, assassinationTargets, assassinate,
  removeTroubleIn, controls, troubleCount, minionLikeCount,
} from './rules';

const fresh = (n = 3) => setupGame(n, (a) => [...a]);

describe('слуги и беспорядки', () => {
  it('ставить можно в свои районы и соседние', () => {
    expect(legalMinionAreas(fresh(), '0')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 12]);
  });

  it('в пустой район — без беспорядка, в занятый — с беспорядком', () => {
    const G = fresh();
    expect(placeMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].minions['0']).toBe(1);
    expect(G.areas[2].trouble).toBe(false);
    expect(G.players['0'].minionSupply).toBe(8);
    expect(placeMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].trouble).toBe(true);
  });

  it('в недоступный район нельзя', () => {
    const G = fresh();
    expect(placeMinion(G, '0', 9)).not.toBeNull();
    expect(G.areas[9].minions['0']).toBe(0);
  });

  it('пустой запас: надо переставить своего слугу, уход снимает беспорядок', () => {
    const G = fresh();
    G.players['0'].minionSupply = 0;
    expect(placeMinion(G, '0', 2)).not.toBeNull();
    expect(placeMinion(G, '0', 2, 5)).toBeNull();
    expect(G.areas[5].minions['0']).toBe(0);
    expect(G.areas[5].trouble).toBe(false);
    expect(G.areas[2].minions['0']).toBe(1);
  });
});

describe('здания', () => {
  it('нельзя при беспорядке, без слуги, без денег', () => {
    const G = fresh();
    expect(canBuildIn(G, '0', 1)).toBe(false); // беспорядок
    expect(canBuildIn(G, '0', 9)).toBe(false); // нет слуги
    placeMinion(G, '0', 2);
    expect(canBuildIn(G, '0', 2)).toBe(false); // $18 > $10
    G.players['0'].money = 20;
    expect(buildIn(G, '0', 2)).toBeNull();
    expect(G.areas[2].building).toBe('0');
    expect(G.players['0'].money).toBe(2);
    expect(G.players['0'].buildingSupply).toBe(5);
    expect(G.areas[2].trouble).toBe(false);
  });

  it('все шесть на поле — переносим своё здание', () => {
    const G = fresh();
    placeMinion(G, '0', 2);
    placeMinion(G, '0', 3);
    G.players['0'].money = 100;
    buildIn(G, '0', 2);
    G.players['0'].buildingSupply = 0;
    expect(buildIn(G, '0', 3)).not.toBeNull();
    expect(buildIn(G, '0', 3, 2)).toBeNull();
    expect(G.areas[2].building).toBeNull();
    expect(G.areas[3].building).toBe('0');
  });
});

describe('убийство и беспорядки', () => {
  it('только чужие фишки в районе с беспорядком; беспорядок снимается', () => {
    const G = fresh();
    G.areas[1].demons = 1;
    const targets = assassinationTargets(G, '0', 1);
    expect(targets).toEqual([{ kind: 'minion', owner: '1' }, { kind: 'minion', owner: '2' }, { kind: 'demon' }]);
    expect(assassinate(G, '0', 1, { kind: 'minion', owner: '0' })).not.toBeNull();
    expect(assassinate(G, '0', 1, { kind: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
    expect(G.players['1'].minionSupply).toBe(10);
    expect(G.areas[1].trouble).toBe(false);
    expect(assassinationTargets(G, '0', 1)).toEqual([]);
  });

  it('снять беспорядок можно только там, где он есть', () => {
    const G = fresh();
    expect(troubleCount(G)).toBe(3);
    expect(removeTroubleIn(G, 2)).not.toBeNull();
    expect(removeTroubleIn(G, 1)).toBeNull();
    expect(troubleCount(G)).toBe(2);
  });

  it('демоны и тролли считаются как слуги', () => {
    const G = fresh();
    G.areas[9].trolls = 1;
    expect(minionLikeCount(G.areas[9])).toBe(1);
  });
});

describe('контроль', () => {
  it('большинство фишек, здание считается, демон и тролли мешают', () => {
    const G = fresh();
    expect(controls(G, '0', 1)).toBe(false); // 1:1:1
    G.areas[1].minions['0'] = 2;
    expect(controls(G, '0', 1)).toBe(true);
    G.areas[1].demons = 1;
    expect(controls(G, '0', 1)).toBe(false);
    G.areas[1].demons = 0;
    G.areas[1].trolls = 2;
    expect(controls(G, '0', 1)).toBe(false);
    G.areas[1].building = '0';
    expect(controls(G, '0', 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./rules"`.

- [ ] **Step 3: Реализация**

`packages/engine/src/rules.ts`:
```ts
import type { AMState, AreaId, AreaState, PlayerID, Target } from './types';
import { AREA_IDS, areaDef } from './data/areas';

/** Слуги всех игроков + демоны + тролли. */
export function minionLikeCount(a: AreaState): number {
  return Object.values(a.minions).reduce((s, n) => s + n, 0) + a.demons + a.trolls;
}

export function areasWithMinionsOf(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => G.areas[id].minions[pid] > 0);
}

/** Районы со своим слугой и соседние с ними. */
export function legalMinionAreas(G: AMState, pid: PlayerID): AreaId[] {
  const set = new Set<AreaId>();
  for (const id of areasWithMinionsOf(G, pid)) {
    set.add(id);
    for (const n of areaDef(id).adjacent) set.add(n);
  }
  return AREA_IDS.filter((id) => set.has(id));
}

/** Вход слугоподобной фишки: беспорядок, если в районе уже кто-то есть. Вызывать ДО добавления фишки. */
function onEnter(a: AreaState): void {
  if (minionLikeCount(a) > 0) a.trouble = true;
}

/** Уход слугоподобной фишки снимает беспорядок. */
function onLeave(a: AreaState): void {
  a.trouble = false;
}

export function placeMinion(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const p = G.players[pid];
  if (!legalMinionAreas(G, pid).includes(area)) return 'Сюда нельзя поставить слугу';
  if (p.minionSupply === 0) {
    if (from == null || from === area || !(G.areas[from]?.minions[pid] > 0)) return 'Укажите, откуда переставить слугу';
    G.areas[from].minions[pid]--;
    onLeave(G.areas[from]);
  } else {
    if (from != null) return 'В запасе есть слуги';
    p.minionSupply--;
  }
  const a = G.areas[area];
  onEnter(a);
  a.minions[pid]++;
  return null;
}

export function canBuildIn(G: AMState, pid: PlayerID, area: AreaId): boolean {
  const a = G.areas[area];
  return !!a && a.minions[pid] > 0 && !a.trouble && a.building === null && G.players[pid].money >= areaDef(area).cost;
}

export function buildableAreas(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => canBuildIn(G, pid, id));
}

export function buildIn(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  if (!canBuildIn(G, pid, area)) return 'Здесь нельзя строить';
  const p = G.players[pid];
  if (p.buildingSupply === 0) {
    if (from == null || G.areas[from]?.building !== pid) return 'Укажите, какое здание перенести';
    G.areas[from].building = null;
  } else {
    if (from != null) return 'В запасе есть здания';
    p.buildingSupply--;
  }
  p.money -= areaDef(area).cost;
  G.areas[area].building = pid;
  return null;
}

export function assassinationTargets(G: AMState, pid: PlayerID, area: AreaId): Target[] {
  const a = G.areas[area];
  if (!a?.trouble) return [];
  const targets: Target[] = [];
  for (const [owner, n] of Object.entries(a.minions)) if (owner !== pid && n > 0) targets.push({ kind: 'minion', owner });
  if (a.demons > 0) targets.push({ kind: 'demon' });
  if (a.trolls > 0) targets.push({ kind: 'troll' });
  return targets;
}

export function assassinationAreas(G: AMState, pid: PlayerID): AreaId[] {
  return AREA_IDS.filter((id) => assassinationTargets(G, pid, id).length > 0);
}

export function sameTarget(a: Target, b: Target): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'minion' || a.owner === (b as { owner: PlayerID }).owner;
}

/** Убирает фишку с поля (слуга возвращается владельцу в запас) и снимает беспорядок. */
export function removeTarget(G: AMState, area: AreaId, t: Target): void {
  const a = G.areas[area];
  if (t.kind === 'minion') {
    a.minions[t.owner]--;
    G.players[t.owner].minionSupply++;
  } else if (t.kind === 'demon') {
    a.demons--;
  } else {
    a.trolls--;
  }
  onLeave(a);
}

export function assassinate(G: AMState, pid: PlayerID, area: AreaId, t: Target): string | null {
  if (!assassinationTargets(G, pid, area).some((x) => sameTarget(x, t))) return 'Эту фишку нельзя убрать';
  removeTarget(G, area, t);
  return null;
}

export function troubleAreas(G: AMState): AreaId[] {
  return AREA_IDS.filter((id) => G.areas[id].trouble);
}

export function troubleCount(G: AMState): number {
  return troubleAreas(G).length;
}

export function removeTroubleIn(G: AMState, area: AreaId): string | null {
  if (!G.areas[area]?.trouble) return 'Здесь нет беспорядков';
  G.areas[area].trouble = false;
  return null;
}

/** Фишки игрока в районе для контроля: слуги + здание. */
export function piecesOf(a: AreaState, pid: PlayerID): number {
  return a.minions[pid] + (a.building === pid ? 1 : 0);
}

export function controls(G: AMState, pid: PlayerID, area: AreaId): boolean {
  const a = G.areas[area];
  const mine = piecesOf(a, pid);
  if (mine === 0 || a.demons > 0 || mine <= a.trolls) return false;
  return Object.keys(a.minions).every((o) => o === pid || piecesOf(a, o) < mine);
}
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './rules';
```

- [ ] **Step 4: Тесты проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Базовые правила: слуги, беспорядки, здания, убийство, контроль

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Условия победы и финальный подсчёт

**Files:**
- Create: `packages/engine/src/victory.ts`, `packages/engine/src/victory.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `controls`, `areasWithMinionsOf`, `troubleCount` из `rules.ts`; `AREA_IDS`, `areaDef`.
- Produces: `LORD_AREAS`, `VETINARI_AREAS`, `DRAGON_TROUBLE = 8`, `CHRYSOPRASE_WORTH = 50`, `buildingValue(G, pid)`, `netWorth(G, pid)`, `hasWon(G, pid, numPlayers): boolean`, `allPersonalities(G): Record<PlayerID, PersonalityId>`, `finalScore(G, pid): number`, `bestDistrictCost(G, pid): number`, `deckOutResult(G): GameOver`.

Правила: лорды — контроль 7/5/4 районов (2/3/4 игрока); Витинари — слуги в 11/10/9 районах; Дракон — 8 жетонов беспорядка на поле; Хризопраз — деньги + цена своих зданий − $12 за займ ≥ $50; Ваймс — побеждает, если колода закончилась. Если колода закончилась и Ваймса нет: очки = $5 за слугу на поле + цена своих зданий + деньги; каждый займ гасится $12, а если денег не хватает — −15 очков. Ничья — у кого карта района дороже.

- [ ] **Step 1: Написать падающие тесты**

`packages/engine/src/victory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import type { AMState, PersonalityId } from './types';
import { hasWon, netWorth, finalScore, deckOutResult } from './victory';

function game(n: number, personalities: PersonalityId[]): AMState {
  const G = setupGame(n, (a) => [...a]);
  personalities.forEach((p, i) => (G.players[String(i)].personality = p));
  return G;
}

describe('условия победы', () => {
  it('лорд втроём: контроль 5 районов', () => {
    const G = game(3, ['lord-rust', 'lord-vetinari', 'chrysoprase']);
    for (const id of [2, 3, 4, 6]) G.areas[id].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(false);
    G.areas[8].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(true);
  });

  it('Витинари втроём: слуги в 10 районах', () => {
    const G = game(3, ['lord-vetinari', 'lord-rust', 'chrysoprase']);
    for (const id of [2, 3, 4, 6, 8, 9]) G.areas[id].minions['0'] = 1; // + стартовые 1, 5, 7 = 9
    expect(hasWon(G, '0', 3)).toBe(false);
    G.areas[10].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(true);
  });

  it('Дракон: 8 жетонов беспорядка', () => {
    const G = game(2, ['dragon-king-of-arms', 'lord-rust']);
    for (const id of [2, 3, 4, 6]) G.areas[id].trouble = true;
    expect(hasWon(G, '0', 2)).toBe(false);
    G.areas[8].trouble = true;
    expect(hasWon(G, '0', 2)).toBe(true);
  });

  it('Хризопраз: состояние с учётом зданий и займов', () => {
    const G = game(3, ['chrysoprase', 'lord-rust', 'lord-selachii']);
    G.players['0'].money = 40;
    G.areas[2].building = '0'; // $18
    expect(netWorth(G, '0')).toBe(58);
    G.players['0'].loans = 1;
    expect(netWorth(G, '0')).toBe(46);
    expect(hasWon(G, '0', 3)).toBe(false);
  });

  it('Ваймс сам по себе не побеждает в начале хода', () => {
    const G = game(2, ['commander-vimes', 'lord-rust']);
    expect(hasWon(G, '0', 2)).toBe(false);
  });
});

describe('конец колоды', () => {
  it('есть Ваймс — он победитель', () => {
    const G = game(2, ['lord-rust', 'commander-vimes']);
    const r = deckOutResult(G);
    expect(r).toMatchObject({ winner: '1', reason: 'vimes' });
    expect(r.personalities).toEqual({ '0': 'lord-rust', '1': 'commander-vimes' });
  });

  it('подсчёт очков: слуги, здания, деньги, займы', () => {
    const G = game(2, ['lord-rust', 'lord-selachii']);
    // У каждого 3 слуги (15) + $10.
    G.areas[2].building = '0'; // +18
    G.players['0'].loans = 1; // гасит $12 из $10 не может → −15
    expect(finalScore(G, '0')).toBe(15 + 18 + 10 - 15);
    G.players['1'].money = 30;
    G.players['1'].loans = 1; // гасит: 30 − 12 = 18
    expect(finalScore(G, '1')).toBe(15 + 18);
  });

  it('ничья: побеждает владелец самого дорогого района', () => {
    const G = game(2, ['lord-rust', 'lord-selachii']);
    G.areas[1].building = '0'; // $6
    G.areas[3].building = '1'; // $12
    G.players['0'].money = 16; // 15 + 6 + 16 = 37
    G.players['1'].money = 10; // 15 + 12 + 10 = 37
    const r = deckOutResult(G);
    expect(r.scores).toEqual({ '0': 37, '1': 37 });
    expect(r.winner).toBe('1');
    expect(r.reason).toBe('score');
  });
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./victory"`.

- [ ] **Step 3: Реализация**

`packages/engine/src/victory.ts`:
```ts
import type { AMState, GameOver, PersonalityId, PlayerID } from './types';
import { LOAN_REPAY, UNPAID_LOAN_PENALTY } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { areasWithMinionsOf, controls, troubleCount } from './rules';

export const LORD_AREAS: Record<number, number> = { 2: 7, 3: 5, 4: 4 };
export const VETINARI_AREAS: Record<number, number> = { 2: 11, 3: 10, 4: 9 };
export const DRAGON_TROUBLE = 8;
export const CHRYSOPRASE_WORTH = 50;

export function buildingValue(G: AMState, pid: PlayerID): number {
  return AREA_IDS.filter((id) => G.areas[id].building === pid).reduce((s, id) => s + areaDef(id).cost, 0);
}

export function netWorth(G: AMState, pid: PlayerID): number {
  const p = G.players[pid];
  return p.money + buildingValue(G, pid) - LOAN_REPAY * p.loans;
}

/** Проверка в начале хода игрока pid. Ваймс здесь никогда не побеждает. */
export function hasWon(G: AMState, pid: PlayerID, numPlayers: number): boolean {
  switch (G.players[pid].personality) {
    case 'lord-selachii':
    case 'lord-rust':
    case 'lord-de-worde':
      return AREA_IDS.filter((id) => controls(G, pid, id)).length >= LORD_AREAS[numPlayers];
    case 'lord-vetinari':
      return areasWithMinionsOf(G, pid).length >= VETINARI_AREAS[numPlayers];
    case 'dragon-king-of-arms':
      return troubleCount(G) >= DRAGON_TROUBLE;
    case 'chrysoprase':
      return netWorth(G, pid) >= CHRYSOPRASE_WORTH;
    default:
      return false;
  }
}

export function allPersonalities(G: AMState): Record<PlayerID, PersonalityId> {
  return Object.fromEntries(Object.entries(G.players).map(([pid, p]) => [pid, p.personality!]));
}

export function finalScore(G: AMState, pid: PlayerID): number {
  const p = G.players[pid];
  let money = p.money;
  let penalty = 0;
  for (let i = 0; i < p.loans; i++) {
    if (money >= LOAN_REPAY) money -= LOAN_REPAY;
    else penalty += UNPAID_LOAN_PENALTY;
  }
  const minions = AREA_IDS.reduce((s, id) => s + G.areas[id].minions[pid], 0);
  return minions * 5 + buildingValue(G, pid) + money - penalty;
}

export function bestDistrictCost(G: AMState, pid: PlayerID): number {
  return Math.max(0, ...AREA_IDS.filter((id) => G.areas[id].building === pid).map((id) => areaDef(id).cost));
}

/** Итог, когда закончилась колода. */
export function deckOutResult(G: AMState): GameOver {
  const pids = Object.keys(G.players);
  const personalities = allPersonalities(G);
  const vimes = pids.find((pid) => G.players[pid].personality === 'commander-vimes');
  if (vimes) return { winner: vimes, reason: 'vimes', personalities };
  const scores = Object.fromEntries(pids.map((pid) => [pid, finalScore(G, pid)]));
  const winner = [...pids].sort(
    (a, b) => scores[b] - scores[a] || bestDistrictCost(G, b) - bestDistrictCost(G, a),
  )[0];
  return { winner, reason: 'score', personalities, scores };
}
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './victory';
```

- [ ] **Step 4: Тесты проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Условия победы личностей и финальный подсчёт

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Розыгрыш карты по символам и ручные действия

**Files:**
- Create: `packages/engine/src/turn.ts`, `packages/engine/src/turn.test.ts`, `packages/engine/src/manual.ts`, `packages/engine/src/manual.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `rules.ts`, `helpers.ts`, `CARD_BY_ID`, `EVENT_BY_ID`, `areaDef`.
- Produces:
  - `turn.ts`: `startTurn(G)`, `currentSymbol(G): CardSymbol | undefined`, `playCard(G, pid, cardId)`, `doMinion(G, pid, area, from?)`, `doBuild(G, pid, area, from?)`, `doAssassinate(G, pid, area, target)`, `doRemoveTrouble(G, pid, area)`, `doMoney(G, pid)`, `doPlayAnother(G, pid)`, `doEvent(G, pid)`, `skipSymbol(G, pid)`, `canEndTurn(G, pid): string | null`, `refillHand(G, pid): void`. Все `do*`/`playCard`/`skipSymbol` возвращают `string | null`.
  - `manual.ts`: тип `ManualAction` (ниже) и `applyManual(G, pid, action): string | null`.

Порядок: карта уходит из руки в `G.play`, её символы выполняются строго слева направо (`queue[0]` — текущий). Любой символ можно пропустить (`skipSymbol`), кроме `event`. Символы `scroll` и `interrupt` в вехе 1 выполняются вручную: игрок делает нужное через ручной режим и жмёт «Готово» (= `skipSymbol`). Когда очередь пуста, карта уходит в сброс. В начале хода `playsLeft = 1`; `playAnother` добавляет одну. Закончить ход можно, когда нет карты в розыгрыше и сыграна хотя бы одна карта (или рука пуста).

- [ ] **Step 1: Написать падающие тесты розыгрыша**

`packages/engine/src/turn.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import type { AMState } from './types';
import {
  startTurn, playCard, currentSymbol, doMoney, doPlayAnother, doMinion, doEvent, skipSymbol,
  doAssassinate, canEndTurn, refillHand,
} from './turn';

function withHand(cards: string[]): AMState {
  const G = setupGame(2, (a) => [...a]);
  G.players['0'].hand = [...cards];
  startTurn(G);
  return G;
}

describe('розыгрыш карты', () => {
  it('символы по очереди; карта уходит в сброс', () => {
    const G = withHand(['pink-pussycat-club']); // $3, сыграть ещё
    expect(playCard(G, '0', 'pink-pussycat-club')).toBeNull();
    expect(G.players['0'].hand).toEqual([]);
    expect(currentSymbol(G)).toEqual({ kind: 'money', amount: 3 });
    expect(doPlayAnother(G, '0')).not.toBeNull(); // не тот символ
    expect(doMoney(G, '0')).toBeNull();
    expect(G.players['0'].money).toBe(13);
    expect(doPlayAnother(G, '0')).toBeNull();
    expect(G.play).toBeNull();
    expect(G.discard).toEqual(['pink-pussycat-club']);
    expect(G.playsLeft).toBe(1);
  });

  it('нельзя сыграть вторую карту без «сыграть ещё»', () => {
    const G = withHand(['dwarves', 'hello']);
    playCard(G, '0', 'dwarves');
    expect(playCard(G, '0', 'hello')).not.toBeNull(); // первая ещё не доиграна
    skipSymbol(G, '0');
    skipSymbol(G, '0');
    expect(G.play).toBeNull();
    expect(playCard(G, '0', 'hello')).not.toBeNull(); // лимит исчерпан
  });

  it('слуга по символу «Агент»', () => {
    const G = withHand(['dwarves']);
    playCard(G, '0', 'dwarves');
    expect(doMinion(G, '0', 9)).not.toBeNull();
    expect(doMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].minions['0']).toBe(1);
    expect(currentSymbol(G)?.kind).toBe('minion');
  });

  it('случайное событие нельзя пропустить; вытянутое событие видно', () => {
    const G = withHand(['rincewind']);
    const top = G.events[0];
    playCard(G, '0', 'rincewind');
    expect(skipSymbol(G, '0')).not.toBeNull();
    expect(doEvent(G, '0')).toBeNull();
    expect(G.lastEvent).toBe(top);
    expect(G.events).toHaveLength(11);
    expect(currentSymbol(G)?.kind).toBe('scroll');
  });

  it('убийство по черепу', () => {
    const G = withHand(['hello']);
    playCard(G, '0', 'hello');
    expect(doAssassinate(G, '0', 1, { kind: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
  });
});

describe('конец хода', () => {
  it('нельзя, пока карта не доиграна или ни одна не сыграна', () => {
    const G = withHand(['dwarves']);
    expect(canEndTurn(G, '0')).not.toBeNull();
    playCard(G, '0', 'dwarves');
    expect(canEndTurn(G, '0')).not.toBeNull();
    skipSymbol(G, '0');
    skipSymbol(G, '0');
    expect(canEndTurn(G, '0')).toBeNull();
  });

  it('с пустой рукой можно сразу', () => {
    const G = withHand([]);
    expect(canEndTurn(G, '0')).toBeNull();
  });

  it('добор до пяти карт', () => {
    const G = withHand(['dwarves']);
    const deck = G.deck.length;
    refillHand(G, '0');
    expect(G.players['0'].hand).toHaveLength(5);
    expect(G.deck).toHaveLength(deck - 4);
  });
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./turn"`.

- [ ] **Step 3: Реализация `turn.ts`**

`packages/engine/src/turn.ts`:
```ts
import type { AMState, AreaId, CardSymbol, PlayerID, SymbolKind, Target } from './types';
import { HAND_SIZE } from './types';
import { CARD_BY_ID, EVENT_BY_ID } from './data/cards';
import { areaDef } from './data/areas';
import { drawCards, log, nameOf } from './helpers';
import { assassinate, buildIn, placeMinion, removeTroubleIn } from './rules';

export function startTurn(G: AMState): void {
  G.play = null;
  G.playsLeft = 1;
  G.cardsPlayed = 0;
  G.lastEvent = null;
}

export function currentSymbol(G: AMState): CardSymbol | undefined {
  return G.play?.queue[0];
}

function finishIfDone(G: AMState): void {
  if (G.play && G.play.queue.length === 0) {
    G.discard.push(G.play.cardId);
    G.play = null;
  }
}

function expectSymbol(G: AMState, kind: SymbolKind): string | null {
  return currentSymbol(G)?.kind === kind ? null : 'Сейчас другое действие';
}

function advance(G: AMState): void {
  G.play!.queue.shift();
  finishIfDone(G);
}

export function playCard(G: AMState, pid: PlayerID, cardId: string): string | null {
  if (G.play) return 'Сначала доиграйте текущую карту';
  if (G.playsLeft < 1) return 'Больше нельзя играть карты';
  const hand = G.players[pid].hand;
  const i = hand.indexOf(cardId);
  if (i < 0 || !CARD_BY_ID[cardId]) return 'Такой карты нет в руке';
  hand.splice(i, 1);
  G.playsLeft--;
  G.cardsPlayed++;
  G.play = { cardId, queue: CARD_BY_ID[cardId].symbols.map((s) => ({ ...s })) };
  log(G, `${nameOf(G, pid)} играет «${CARD_BY_ID[cardId].name}»`);
  finishIfDone(G);
  return null;
}

export function doMinion(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const e = expectSymbol(G, 'minion') ?? placeMinion(G, pid, area, from);
  if (e) return e;
  log(G, `${nameOf(G, pid)} ставит слугу: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doBuild(G: AMState, pid: PlayerID, area: AreaId, from?: AreaId): string | null {
  const e = expectSymbol(G, 'building') ?? buildIn(G, pid, area, from);
  if (e) return e;
  log(G, `${nameOf(G, pid)} строит здание: ${areaDef(area).name} (−$${areaDef(area).cost})`);
  advance(G);
  return null;
}

export function doAssassinate(G: AMState, pid: PlayerID, area: AreaId, target: Target): string | null {
  const e = expectSymbol(G, 'assassinate') ?? assassinate(G, pid, area, target);
  if (e) return e;
  const victim = target.kind === 'minion' ? `слугу ${nameOf(G, target.owner)}` : target.kind === 'demon' ? 'демона' : 'тролля';
  log(G, `${nameOf(G, pid)} убирает ${victim}: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doRemoveTrouble(G: AMState, pid: PlayerID, area: AreaId): string | null {
  const e = expectSymbol(G, 'removeTrouble') ?? removeTroubleIn(G, area);
  if (e) return e;
  log(G, `${nameOf(G, pid)} убирает беспорядок: ${areaDef(area).name}`);
  advance(G);
  return null;
}

export function doMoney(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'money');
  if (e) return e;
  const amount = currentSymbol(G)!.amount ?? 0;
  G.players[pid].money += amount;
  log(G, `${nameOf(G, pid)} берёт из банка $${amount}`);
  advance(G);
  return null;
}

export function doPlayAnother(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'playAnother');
  if (e) return e;
  G.playsLeft++;
  advance(G);
  return null;
}

export function doEvent(G: AMState, pid: PlayerID): string | null {
  const e = expectSymbol(G, 'event');
  if (e) return e;
  const ev = G.events.shift();
  if (ev) {
    G.lastEvent = ev;
    log(G, `Случайное событие: «${EVENT_BY_ID[ev].name}» — выполните его вручную`);
  } else {
    log(G, 'Случайные события закончились');
  }
  advance(G);
  return null;
}

export function skipSymbol(G: AMState, pid: PlayerID): string | null {
  const s = currentSymbol(G);
  if (!s) return 'Нет действия';
  if (s.kind === 'event') return 'Случайное событие нельзя пропустить';
  advance(G);
  return null;
}

export function canEndTurn(G: AMState, pid: PlayerID): string | null {
  if (G.play) return 'Сначала доиграйте карту';
  if (G.cardsPlayed === 0 && G.players[pid].hand.length > 0) return 'Сначала сыграйте карту';
  return null;
}

export function refillHand(G: AMState, pid: PlayerID): void {
  const need = HAND_SIZE - G.players[pid].hand.length;
  if (need > 0) drawCards(G, pid, need);
}
```

- [ ] **Step 4: Тесты розыгрыша проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Написать падающие тесты ручного режима**

`packages/engine/src/manual.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import { applyManual } from './manual';

const fresh = () => setupGame(3, (a) => [...a]);

describe('ручной режим', () => {
  it('слуга из запаса и обратно, без автоматических беспорядков', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: 1 })).toBeNull();
    expect(G.areas[9].minions['1']).toBe(1);
    expect(G.players['1'].minionSupply).toBe(8);
    expect(G.areas[9].trouble).toBe(false);
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: -1 })).toBeNull();
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: -1 })).not.toBeNull();
  });

  it('здание: смена владельца возвращает старое в запас', () => {
    const G = fresh();
    applyManual(G, '0', { type: 'building', area: 4, owner: '1' });
    expect(G.players['1'].buildingSupply).toBe(5);
    applyManual(G, '0', { type: 'building', area: 4, owner: '2' });
    expect(G.players['1'].buildingSupply).toBe(6);
    expect(G.players['2'].buildingSupply).toBe(5);
    applyManual(G, '0', { type: 'building', area: 4, owner: null });
    expect(G.areas[4].building).toBeNull();
    expect(G.players['2'].buildingSupply).toBe(6);
  });

  it('демонов не больше четырёх', () => {
    const G = fresh();
    for (let i = 0; i < 4; i++) expect(applyManual(G, '0', { type: 'demon', area: 9, delta: 1 })).toBeNull();
    expect(applyManual(G, '0', { type: 'demon', area: 10, delta: 1 })).not.toBeNull();
  });

  it('деньги: банк ↔ игрок, игрок → игрок, без ухода в минус', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'money', from: '1', to: '0', amount: 4 })).toBeNull();
    expect(G.players['0'].money).toBe(14);
    expect(G.players['1'].money).toBe(6);
    expect(applyManual(G, '0', { type: 'money', from: '1', to: 'bank', amount: 7 })).not.toBeNull();
    expect(applyManual(G, '0', { type: 'money', from: 'bank', to: '2', amount: 5 })).toBeNull();
    expect(G.players['2'].money).toBe(15);
  });

  it('карты: сбросить, передать, взять из сброса', () => {
    const G = fresh();
    const [a, b] = G.players['0'].hand;
    expect(applyManual(G, '0', { type: 'discard', cardId: a })).toBeNull();
    expect(G.discard).toEqual([a]);
    expect(applyManual(G, '0', { type: 'give', cardId: b, to: '2' })).toBeNull();
    expect(G.players['2'].hand).toContain(b);
    expect(applyManual(G, '0', { type: 'takeDiscard', cardId: a })).toBeNull();
    expect(G.players['0'].hand).toContain(a);
    expect(G.discard).toEqual([]);
  });

  it('займы и беспорядки', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'loan', player: '0', delta: -1 })).not.toBeNull();
    expect(applyManual(G, '0', { type: 'loan', player: '0', delta: 1 })).toBeNull();
    expect(G.players['0'].loans).toBe(1);
    applyManual(G, '0', { type: 'trouble', area: 9, on: true });
    expect(G.areas[9].trouble).toBe(true);
  });

  it('каждое действие пишется в лог', () => {
    const G = fresh();
    applyManual(G, '0', { type: 'trouble', area: 9, on: true });
    expect(G.log.at(-1)).toContain('✋');
  });
});
```

- [ ] **Step 6: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./manual"`.

- [ ] **Step 7: Реализация `manual.ts`**

`packages/engine/src/manual.ts`:
```ts
import type { AMState, AreaId, PlayerID } from './types';
import { MAX_DEMONS, MAX_TROLLS } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { CARD_BY_ID } from './data/cards';
import { log, nameOf } from './helpers';

export type ManualAction =
  | { type: 'minion'; area: AreaId; owner: PlayerID; delta: 1 | -1 }
  | { type: 'building'; area: AreaId; owner: PlayerID | null }
  | { type: 'trouble'; area: AreaId; on: boolean }
  | { type: 'demon'; area: AreaId; delta: 1 | -1 }
  | { type: 'troll'; area: AreaId; delta: 1 | -1 }
  | { type: 'money'; from: PlayerID | 'bank'; to: PlayerID | 'bank'; amount: number }
  | { type: 'loan'; player: PlayerID; delta: 1 | -1 }
  | { type: 'discard'; cardId: string }
  | { type: 'give'; cardId: string; to: PlayerID }
  | { type: 'takeDiscard'; cardId: string };

const sign = (d: number) => (d > 0 ? '+' : '−');

/** Ручная правка состояния (для текстов карт и событий, которые пока не автоматизированы). */
export function applyManual(G: AMState, pid: PlayerID, a: ManualAction): string | null {
  const who = `✋ ${nameOf(G, pid)}`;
  const holder = (p: PlayerID | 'bank') => (p === 'bank' ? 'банк' : nameOf(G, p));

  switch (a.type) {
    case 'minion': {
      const area = G.areas[a.area];
      const owner = G.players[a.owner];
      if (!area || !owner) return 'Нет такого района или игрока';
      if (a.delta > 0) {
        if (owner.minionSupply < 1) return 'Нет слуг в запасе';
        owner.minionSupply--;
        area.minions[a.owner]++;
      } else {
        if (area.minions[a.owner] < 1) return 'Там нет такого слуги';
        area.minions[a.owner]--;
        owner.minionSupply++;
      }
      log(G, `${who}: ${sign(a.delta)}слуга ${nameOf(G, a.owner)}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'building': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      if (area.building === a.owner) return 'Ничего не меняется';
      if (a.owner !== null) {
        const owner = G.players[a.owner];
        if (!owner || owner.buildingSupply < 1) return 'Нет зданий в запасе';
        owner.buildingSupply--;
      }
      if (area.building !== null) G.players[area.building].buildingSupply++;
      area.building = a.owner;
      log(G, `${who}: здание в «${areaDef(a.area).name}» — ${a.owner === null ? 'убрано' : nameOf(G, a.owner)}`);
      return null;
    }
    case 'trouble': {
      if (!G.areas[a.area]) return 'Нет такого района';
      G.areas[a.area].trouble = a.on;
      log(G, `${who}: беспорядок ${a.on ? 'положен' : 'убран'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'demon':
    case 'troll': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      const key = a.type === 'demon' ? 'demons' : 'trolls';
      const max = a.type === 'demon' ? MAX_DEMONS : MAX_TROLLS;
      const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id][key], 0);
      if (a.delta > 0 && onBoard >= max) return 'Все такие фишки уже на поле';
      if (a.delta < 0 && area[key] < 1) return 'Здесь их нет';
      area[key] += a.delta;
      log(G, `${who}: ${sign(a.delta)}${a.type === 'demon' ? 'демон' : 'тролль'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'money': {
      if (!Number.isInteger(a.amount) || a.amount <= 0) return 'Неверная сумма';
      if (a.from === a.to) return 'Отправитель и получатель совпадают';
      if (a.from !== 'bank') {
        const from = G.players[a.from];
        if (!from) return 'Нет такого игрока';
        if (from.money < a.amount) return 'Не хватает денег';
        from.money -= a.amount;
      }
      if (a.to !== 'bank') {
        if (!G.players[a.to]) return 'Нет такого игрока';
        G.players[a.to].money += a.amount;
      }
      log(G, `${who}: $${a.amount} ${holder(a.from)} → ${holder(a.to)}`);
      return null;
    }
    case 'loan': {
      const p = G.players[a.player];
      if (!p) return 'Нет такого игрока';
      if (a.delta < 0 && p.loans < 1) return 'Займов нет';
      p.loans += a.delta;
      log(G, `${who}: ${a.delta > 0 ? 'займ взят' : 'займ погашен'} — ${nameOf(G, a.player)}`);
      return null;
    }
    case 'discard': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      hand.splice(i, 1);
      G.discard.push(a.cardId);
      log(G, `${who}: сбрасывает «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
    case 'give': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      if (!G.players[a.to] || a.to === pid) return 'Некому передать';
      hand.splice(i, 1);
      G.players[a.to].hand.push(a.cardId);
      log(G, `${who}: передаёт карту игроку ${nameOf(G, a.to)}`);
      return null;
    }
    case 'takeDiscard': {
      const i = G.discard.lastIndexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в сбросе';
      G.discard.splice(i, 1);
      G.players[pid].hand.push(a.cardId);
      log(G, `${who}: берёт из сброса «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
  }
}
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './turn';
export * from './manual';
```

- [ ] **Step 8: Тесты проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/engine/src
git commit -m "Розыгрыш карты по символам и ручной режим

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Определение игры boardgame.io, playerView, отмена, интеграция

**Files:**
- Create: `packages/engine/src/view.ts`, `packages/engine/src/game.ts`, `packages/engine/src/game.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: всё из Task 3–6.
- Produces:
  - `view.ts`: `HIDDEN_CARD = '?'`, `playerView({ G, playerID }): AMState`, `deckSize(G): number`, `eventsLeft(G): number`.
  - `game.ts`: `GAME_ID = 'ankh-morpork'`, `AnkhMorporkGame: Game<AMState>`.
  - Фазы: `lobby` (ходы `setName(name)`, `setColor(color, forPid?)`, `startGame()`), `play` (ходы `playCard(cardId)`, `placeMinion(area, from?)`, `build(area, from?)`, `assassinate(area, target)`, `removeTrouble(area)`, `takeMoney()`, `playAnother()`, `drawEvent()`, `skipSymbol()`, `manual(action)`, `manualDraw()`, `finishTurn()`).
  - Для хотсита и тестов: `{ ...AnkhMorporkGame, playerView: undefined }` — boardgame.io подставит тождественный playerView.

- [ ] **Step 1: Написать падающие тесты**

`packages/engine/src/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import type { Game } from 'boardgame.io';
import { AnkhMorporkGame } from './game';
import { playerView, HIDDEN_CARD } from './view';
import type { AMState } from './types';
import { COLORS } from './types';
import { currentSymbol } from './turn';
import { assassinationAreas, assassinationTargets, buildableAreas, legalMinionAreas, troubleAreas } from './rules';
import { AREA_IDS } from './data/areas';

const testGame: Game<AMState> = { ...AnkhMorporkGame, playerView: undefined };

function started(numPlayers: number, game: Game<AMState> = testGame) {
  const client = Client<AMState>({ game, numPlayers });
  client.start();
  COLORS.slice(0, numPlayers).forEach((c, i) => client.moves.setColor(c, String(i)));
  client.moves.startGame();
  return client;
}

/** Игра, где у каждого игрока первая карта в руке — Ринсвинд (событие, свиток, ещё карта). */
const withRincewind: Game<AMState> = {
  ...testGame,
  setup: (args) => {
    const G = AnkhMorporkGame.setup!(args as never);
    for (const p of Object.values(G.players)) p.hand[0] = 'rincewind';
    return G;
  },
};

describe('лобби', () => {
  it('без цветов старт невозможен; после старта — фаза play', () => {
    const client = Client<AMState>({ game: testGame, numPlayers: 2 });
    client.start();
    client.moves.startGame();
    expect(client.getState()!.ctx.phase).toBe('lobby');
    client.moves.setColor('red', '0');
    client.moves.setColor('blue', '1');
    client.moves.startGame();
    const { G, ctx } = client.getState()!;
    expect(ctx.phase).toBe('play');
    expect(G.started).toBe(true);
    expect(G.playsLeft).toBe(1);
  });
});

describe('скрытая информация', () => {
  it('чужие руки и личности скрыты, колоды — только размер', () => {
    const client = started(3);
    const G = client.getState()!.G;
    const v = playerView({ G, playerID: '1' });
    expect(v.players['1'].hand).toEqual(G.players['1'].hand);
    expect(v.players['1'].personality).toBe(G.players['1'].personality);
    expect(v.players['0'].hand.every((c) => c === HIDDEN_CARD)).toBe(true);
    expect(v.players['0'].hand).toHaveLength(5);
    expect(v.players['0'].personality).toBeNull();
    expect(v.deck).toEqual([]);
    expect(v.deckCount).toBe(G.deck.length);
    expect(v.events).toEqual([]);
    expect(v.eventsCount).toBe(12);
  });
});

describe('отмена', () => {
  it('сыгранную карту можно отменить', () => {
    const client = started(2);
    const { G, ctx } = client.getState()!;
    const card = G.players[ctx.currentPlayer].hand[1];
    client.moves.playCard(card);
    expect(client.getState()!.G.play).not.toBeNull();
    client.undo();
    const after = client.getState()!.G;
    expect(after.play).toBeNull();
    expect(after.players[ctx.currentPlayer].hand).toContain(card);
  });

  it('вытянутое событие отменить нельзя', () => {
    const client = started(2, withRincewind);
    client.moves.playCard('rincewind');
    client.moves.drawEvent();
    const ev = client.getState()!.G.lastEvent;
    expect(ev).not.toBeNull();
    client.undo();
    expect(client.getState()!.G.lastEvent).toBe(ev);
  });
});

describe('победа в начале хода', () => {
  it('Дракон при 8 беспорядках выигрывает в начале своего хода', () => {
    const dragon: Game<AMState> = {
      ...testGame,
      setup: (args) => {
        const G = AnkhMorporkGame.setup!(args as never);
        for (const p of Object.values(G.players)) p.personality = 'dragon-king-of-arms';
        for (const id of AREA_IDS.slice(0, 8)) G.areas[id].trouble = true;
        return G;
      },
    };
    const client = started(2, dragon);
    const { ctx } = client.getState()!;
    expect(ctx.gameover).toMatchObject({ winner: ctx.currentPlayer, reason: 'personality' });
  });
});

/** Детерминированный генератор для автопартий. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function autoplay(numPlayers: number, seed: number) {
  const client = started(numPlayers, { ...testGame, seed: `seed-${seed}` });
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  for (let step = 0; step < 20000; step++) {
    const { G, ctx } = client.getState()!;
    if (ctx.gameover) return ctx.gameover;
    const pid = ctx.currentPlayer;
    const p = G.players[pid];
    if (!G.play) {
      if (G.playsLeft > 0 && p.hand.length > 0 && (G.cardsPlayed === 0 || r() < 0.5)) client.moves.playCard(pick(p.hand));
      else client.moves.finishTurn();
      continue;
    }
    const sym = currentSymbol(G)!;
    switch (sym.kind) {
      case 'minion': {
        const t = legalMinionAreas(G, pid);
        if (p.minionSupply > 0 && t.length) client.moves.placeMinion(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'building': {
        const t = buildableAreas(G, pid);
        if (p.buildingSupply > 0 && t.length) client.moves.build(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'assassinate': {
        const t = assassinationAreas(G, pid);
        if (t.length) {
          const area = pick(t);
          client.moves.assassinate(area, assassinationTargets(G, pid, area)[0]);
        } else client.moves.skipSymbol();
        break;
      }
      case 'removeTrouble': {
        const t = troubleAreas(G);
        if (t.length) client.moves.removeTrouble(pick(t));
        else client.moves.skipSymbol();
        break;
      }
      case 'money': client.moves.takeMoney(); break;
      case 'playAnother': client.moves.playAnother(); break;
      case 'event': client.moves.drawEvent(); break;
      default: client.moves.skipSymbol();
    }
  }
  throw new Error('Партия не закончилась за 20000 шагов (какой-то ход отклоняется)');
}

describe('автопартии до конца', () => {
  for (const n of [2, 3, 4]) {
    for (const seed of [1, 2, 3]) {
      it(`${n} игрока, seed ${seed}`, () => {
        const over = autoplay(n, seed);
        expect(['personality', 'vimes', 'score']).toContain(over.reason);
        expect(over.winner).not.toBeNull();
      });
    }
  }
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./game"`.

- [ ] **Step 3: Реализация `view.ts`**

`packages/engine/src/view.ts`:
```ts
import type { AMState, PlayerID } from './types';

export const HIDDEN_CARD = '?';

/** Что видит игрок: свою руку и личность; у остальных — только число карт; колоды — только размер. */
export function playerView({ G, playerID }: { G: AMState; playerID?: PlayerID | null }): AMState {
  const players = Object.fromEntries(
    Object.entries(G.players).map(([pid, p]) => [
      pid,
      pid === playerID || G.gameover ? p : { ...p, hand: p.hand.map(() => HIDDEN_CARD), personality: null },
    ]),
  );
  return { ...G, players, deck: [], events: [], deckCount: G.deck.length, eventsCount: G.events.length };
}

export const deckSize = (G: AMState): number => G.deckCount ?? G.deck.length;
export const eventsLeft = (G: AMState): number => G.eventsCount ?? G.events.length;
```

- [ ] **Step 4: Реализация `game.ts`**

`packages/engine/src/game.ts`:
```ts
import type { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { AMState, AreaId, Target } from './types';
import { applySetColor, applySetName, setupGame } from './setup';
import { drawCards, log, nameOf } from './helpers';
import {
  canEndTurn, doAssassinate, doBuild, doEvent, doMinion, doMoney, doPlayAnother, doRemoveTrouble,
  playCard, refillHand, skipSymbol, startTurn,
} from './turn';
import { applyManual, type ManualAction } from './manual';
import { allPersonalities, deckOutResult, hasWon } from './victory';
import { playerView } from './view';

export const GAME_ID = 'ankh-morpork';

const check = (error: string | null) => (error ? INVALID_MOVE : undefined);

export const AnkhMorporkGame: Game<AMState> = {
  name: GAME_ID,
  minPlayers: 2,
  maxPlayers: 4,

  setup: ({ ctx, random }) => setupGame(ctx.numPlayers, random.Shuffle),
  playerView,
  endIf: ({ G }) => G.gameover ?? undefined,

  phases: {
    // Лобби: имена, цвета; хост жмёт «Начать игру», первый игрок — бросок кубика.
    lobby: {
      start: true,
      next: 'play',
      endIf: ({ G }) => G.started,
      turn: { activePlayers: { all: 'default' } },
      moves: {
        setName: ({ G, playerID }, name: string) => check(applySetName(G, playerID, name)),
        setColor: ({ G, playerID }, color: string, forPid?: string) =>
          check(applySetColor(G, playerID, forPid ?? playerID, color)),
        startGame: ({ G, ctx, random, playerID }) => {
          if (playerID !== '0' || G.started) return INVALID_MOVE;
          if (Object.values(G.players).some((p) => !p.color)) return INVALID_MOVE;
          G.started = true;
          G.startIndex = random.Die(ctx.numPlayers) - 1;
          log(G, 'Игра началась');
        },
      },
    },

    play: {
      turn: {
        order: {
          first: ({ G }) => G.startIndex,
          next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },
        onBegin: ({ G, ctx }) => {
          startTurn(G);
          const pid = ctx.currentPlayer;
          if (hasWon(G, pid, ctx.numPlayers)) {
            G.gameover = { winner: pid, reason: 'personality', personalities: allPersonalities(G) };
            log(G, `${nameOf(G, pid)} выполняет условие победы!`);
          } else {
            log(G, `Ход: ${nameOf(G, pid)}`);
          }
        },
      },
      moves: {
        playCard: ({ G, playerID }, cardId: string) => check(playCard(G, playerID, cardId)),
        placeMinion: ({ G, playerID }, area: AreaId, from?: AreaId) => check(doMinion(G, playerID, area, from)),
        build: ({ G, playerID }, area: AreaId, from?: AreaId) => check(doBuild(G, playerID, area, from)),
        assassinate: ({ G, playerID }, area: AreaId, target: Target) => check(doAssassinate(G, playerID, area, target)),
        removeTrouble: ({ G, playerID }, area: AreaId) => check(doRemoveTrouble(G, playerID, area)),
        takeMoney: ({ G, playerID }) => check(doMoney(G, playerID)),
        playAnother: ({ G, playerID }) => check(doPlayAnother(G, playerID)),
        skipSymbol: ({ G, playerID }) => check(skipSymbol(G, playerID)),
        manual: ({ G, playerID }, action: ManualAction) => check(applyManual(G, playerID, action)),

        // Открывают скрытое: только на сервере, отмена через них невозможна.
        drawEvent: {
          move: ({ G, playerID }) => check(doEvent(G, playerID)),
          client: false,
          undoable: false,
        },
        manualDraw: {
          move: ({ G, playerID }) => {
            if (drawCards(G, playerID, 1) === 0) return INVALID_MOVE;
            log(G, `✋ ${nameOf(G, playerID)}: берёт карту из колоды`);
          },
          client: false,
          undoable: false,
        },
        finishTurn: {
          move: ({ G, playerID, events }) => {
            if (canEndTurn(G, playerID)) return INVALID_MOVE;
            refillHand(G, playerID);
            if (G.deck.length === 0) {
              G.gameover = deckOutResult(G);
              log(G, 'Колода закончилась — игра окончена');
              return;
            }
            events.endTurn();
          },
          client: false,
          undoable: false,
        },
      },
    },
  },
};
```

Добавить в `packages/engine/src/index.ts`:
```ts
export * from './view';
export * from './game';
```

- [ ] **Step 5: Тесты проходят**

```bash
npm test
```
Expected: PASS, включая 9 автопартий. Если автопартия падает с «не закончилась», вывести в тесте `currentSymbol(G)` и `G.log.slice(-5)` на последнем шаге и найти отклоняемый ход (обычно — несоответствие сигнатуры хода или проверки `playerID`).

- [ ] **Step 6: Сборка движка**

```bash
npm run build -w packages/engine
```
Expected: без ошибок TypeScript.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src
git commit -m "Игра boardgame.io: лобби, ход, скрытая информация, отмена, автопартии

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Сервер и оболочка клиента (лобби, комната, хотсит)

**Files:**
- Create: `packages/server/{package.json,tsconfig.json,src/index.ts}`, `packages/client/{package.json,tsconfig.json,vite.config.ts,index.html}`, `packages/client/src/{main.tsx,App.tsx,net.ts,Page.tsx,Home.tsx,GameRoom.tsx,LocalGame.tsx,styles.css}`, `packages/client/src/table/{Table.tsx,Lobby.tsx,assets.ts}`, `packages/client/public/fonts/FolkardCyr.ttf`, `scripts/net-test.mjs`, `scripts/shot.mjs`

**Interfaces:**
- Consumes: `AnkhMorporkGame`, `GAME_ID`, `COLORS`, `AMState`, `Color` из `@am/engine`.
- Produces:
  - `table/Table.tsx`: `NetBoard`, `HotseatBoard` (boardgame.io board-компоненты); в этой задаче `Table` показывает лобби, а в фазе `play` — заглушку «Поле в разработке» с текущим игроком.
  - `table/assets.ts`: пути картинок и цвета (полный код ниже, дальше не меняется).
  - Лобби: `Lobby({ G, ctx, me, moves, nameOf })`.
  - CSS-классы, на которые опирается `scripts/net-test.mjs`: `.home`, `.seat-list`, `.table`, `.joined`.

- [ ] **Step 1: Сервер**

В корневом `package.json` расширить `workspaces`:
```json
  "workspaces": [
    "packages/engine",
    "packages/server",
    "packages/client"
  ],
```

`packages/server/package.json`:
```json
{
  "name": "@am/server",
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@am/engine": "*",
    "boardgame.io": "^0.50.2",
    "koa-static": "^5.0.0",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/koa-static": "^4.0.4"
  }
}
```

`packages/server/tsconfig.json` — копия из «Киклад»:
```bash
mkdir -p packages/server/src && cp ../ancient-greece/packages/server/tsconfig.json packages/server/
```

`packages/server/src/index.ts`:
```ts
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
```

- [ ] **Step 2: Пакет клиента**

`packages/client/package.json`:
```json
{
  "name": "@am/client",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@am/engine": "*",
    "boardgame.io": "^0.50.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

```bash
cp ../ancient-greece/packages/client/tsconfig.json ../ancient-greece/packages/client/vite.config.ts packages/client/
mkdir -p packages/client/public/fonts packages/client/src/table packages/client/src/dev
cp source/FolkardCyr/FolkardCyr.ttf packages/client/public/fonts/
```

`packages/client/index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/webp" href="/cards/back-play.webp" />
    <title>Анк-Морпорк</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/client/src/main.tsx` — копия из «Киклад»:
```bash
cp ../ancient-greece/packages/client/src/main.tsx packages/client/src/
```

- [ ] **Step 3: Маршруты, сеть, страницы**

`packages/client/src/App.tsx`:
```tsx
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
```

`packages/client/src/dev/AreaEditor.tsx` — временная заглушка (полная версия в Task 10):
```tsx
export function AreaEditor() {
  return <div className="page"><p>Редактор районов появится в Task 10.</p></div>;
}
```

`packages/client/src/net.ts`:
```ts
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LobbyClient } from 'boardgame.io/client';
import { AnkhMorporkGame, GAME_ID } from '@am/engine';
import { NetBoard } from './table/Table';

// dev (Vite на 5173) — сервер на том же хосте, порт 3001; prod — тот же origin.
export const SERVER =
  import.meta.env.VITE_SERVER ?? (import.meta.env.DEV ? `http://${location.hostname}:3001` : location.origin);

export const lobby = new LobbyClient({ server: SERVER });

export const NetClient = Client({
  game: AnkhMorporkGame,
  board: NetBoard,
  multiplayer: SocketIO({ server: SERVER }),
  debug: false,
});

export { GAME_ID };

export interface Seat {
  playerID: string;
  credentials: string;
  name: string;
}

const seatKey = (matchID: string) => `am:seat:${matchID}`;

export function loadSeat(matchID: string): Seat | null {
  try {
    const raw = localStorage.getItem(seatKey(matchID));
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function saveSeat(matchID: string, seat: Seat): void {
  try {
    localStorage.setItem(seatKey(matchID), JSON.stringify(seat));
  } catch {
    /* приватный режим — место не запомнится */
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem('am:name') ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string): void {
  try {
    localStorage.setItem('am:name', name);
  } catch {
    /* ignore */
  }
}
```

`packages/client/src/Page.tsx`:
```tsx
import type { ReactNode } from 'react';

/** Обложка экранов вне партии: пергамент, заголовок шрифтом FolkardCyr. */
export function Page({ title = 'Анк-Морпорк', subtitle, children }: {
  title?: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <div className="page">
      <main className="page-main">
        <header className="page-head">
          <h1>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}

export function PlayerCountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="page-count" role="radiogroup" aria-label="Число игроков">
      {[2, 3, 4].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n}
          className={value === n ? 'on' : ''} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
```

`packages/client/src/Home.tsx`:
```tsx
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
```

`packages/client/src/GameRoom.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { Page } from './Page';
import { lobby, GAME_ID, NetClient, loadSeat, saveSeat, savedName, rememberName, type Seat } from './net';

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
```

`packages/client/src/LocalGame.tsx`:
```tsx
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
```

- [ ] **Step 4: Ассеты клиента (окончательный файл)**

`packages/client/src/table/assets.ts`:
```ts
import { CARD_BY_ID, type Color, type PersonalityId } from '@am/engine';

export const BACK_PLAY = '/cards/back-play.webp';
export const BACK_EVENT = '/events/back.webp';
export const BACK_PERSONALITY = '/personalities/back.webp';
export const BOARD = '/board.webp';

export function cardImg(id: string): string {
  const c = CARD_BY_ID[id];
  return c ? `/cards/${c.deck}/${id}.webp` : BACK_PLAY;
}
export const eventImg = (id: string) => `/events/${id}.webp`;
export const personalityImg = (id: PersonalityId) => `/personalities/${id}.webp`;
export const districtImg = (n: number) => `/districts/${n}.webp`;

export const tokenImg = (kind: 'minion' | 'building', color: Color) => `/tokens/${kind}-${color}.webp`;
export const TROUBLE = '/tokens/trouble.webp';
export const DEMON = '/tokens/demon.webp';
export const TROLL = '/tokens/troll.webp';

export const COLOR_HEX: Record<Color, string> = { red: '#c8322b', yellow: '#e2b42b', green: '#3d8c3a', blue: '#2f63b8' };
export const COLOR_NAME: Record<Color, string> = { red: 'красный', yellow: 'жёлтый', green: 'зелёный', blue: 'синий' };
```

- [ ] **Step 5: Лобби и временный стол**

`packages/client/src/table/Lobby.tsx`:
```tsx
import { COLORS, type AMState } from '@am/engine';
import { COLOR_HEX, COLOR_NAME } from './assets';
import { Page } from '../Page';

export function Lobby({ G, ctx, me, moves, nameOf }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
}) {
  const pids = Object.keys(G.players);
  const isHost = me === '0';
  const ready = pids.every((pid) => G.players[pid].color);
  return (
    <Page title="Перед партией" subtitle="Выберите цвет фишек. Хост начинает игру, когда все готовы.">
      <section className="page-card">
        <div className="seat-list">
          {pids.map((pid) => {
            const color = G.players[pid].color;
            const canPick = me === pid || isHost;
            return (
              <div key={pid} className={`seat ${pid === me ? 'me' : ''}`} style={{ borderLeftColor: color ? COLOR_HEX[color] : undefined }}>
                <span className="seat-name"><b>{nameOf(pid)}</b>{pid === me && ' (вы)'}</span>
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
        {isHost
          ? <button className="btn" disabled={!ready} onClick={() => moves.startGame()}>Начать игру</button>
          : <div className="page-note">Ждём, пока хост начнёт игру…</div>}
      </section>
    </Page>
  );
}
```

`packages/client/src/table/Table.tsx` (временная версия; в Task 11 заменяется полностью):
```tsx
import { useEffect } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { AMState } from '@am/engine';
import { Lobby } from './Lobby';

interface MatchPlayer { id: number; name?: string }

export function NetBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.playerID} matchData={p.matchData as MatchPlayer[] | undefined} />;
}

export function HotseatBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.ctx.currentPlayer} />;
}

export interface TableProps {
  G: AMState; ctx: any; moves: any; undo: () => void; me: string | null; matchData?: MatchPlayer[];
}

export function Table({ G, ctx, moves, me, matchData }: TableProps) {
  const nameOf = (pid: string) => matchData?.find((m) => String(m.id) === pid)?.name || G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;

  // Имя из лобби boardgame.io переносим в состояние игры, чтобы оно попадало в лог.
  useEffect(() => {
    if (ctx.phase !== 'lobby' || !me || !matchData) return;
    const n = matchData.find((m) => String(m.id) === me)?.name;
    if (n && G.players[me]?.name !== n) moves.setName(n);
  }, [ctx.phase, me, matchData, G.players, moves]);

  if (ctx.phase === 'lobby') return <Lobby G={G} ctx={ctx} me={me} moves={moves} nameOf={nameOf} />;
  return <div className="table"><p>Поле в разработке. Ходит: {nameOf(ctx.currentPlayer)}</p></div>;
}
```

- [ ] **Step 6: Стили (базовые)**

`packages/client/src/styles.css`:
```css
@font-face { font-family: 'FolkardCyr'; src: url('/fonts/FolkardCyr.ttf') format('truetype'); font-display: swap; }

:root {
  --ink: #2b1d0e; --paper: #efe1bf; --paper-2: #e3cf9f; --brown: #6b4423; --gold: #b8892e;
  --red: #a32d22; --shadow: 0 2px 8px #0005;
  color-scheme: light;
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink); background: #3a2a19; }
button { font: inherit; cursor: pointer; }
button:disabled { cursor: default; opacity: 0.5; }

.page { min-height: 100%; display: flex; justify-content: center; background: radial-gradient(#4a361f, #241708); }
.page-main { width: 100%; max-width: 480px; padding: 2rem 1rem; }
.page-head { text-align: center; color: var(--paper); margin-bottom: 1.2rem; }
.page-head h1 { font-family: 'FolkardCyr', Georgia, serif; font-weight: 400; font-size: 3rem; margin: 0; letter-spacing: 0.02em; }
.page-sub { opacity: 0.85; line-height: 1.45; }
.page-card { background: var(--paper); border: 1px solid var(--brown); border-radius: 6px; padding: 1rem 1.1rem;
  margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.7rem; box-shadow: var(--shadow); }
.page-card h2 { font-family: 'FolkardCyr', Georgia, serif; font-weight: 400; margin: 0; font-size: 1.6rem; }
.page-card label, .page-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.page-card input { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--brown); border-radius: 4px; background: #fffaf0; }
.page-count { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.page-count button { padding: 0.4rem 0; border: 1px solid var(--brown); border-radius: 4px; background: #fffaf0; font-size: 1.2rem; }
.page-count button.on { background: var(--brown); color: var(--paper); }
.page-link { display: block; text-align: center; color: var(--paper); }
.page-note { text-align: center; opacity: 0.8; }
.err { color: var(--red); }
.btn { padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid var(--brown); background: var(--brown); color: var(--paper); }
.btn.ghost { background: transparent; color: var(--brown); }
.btn.small { padding: 0.2rem 0.6rem; font-size: 0.85rem; }
.share code { word-break: break-all; font-size: 0.8rem; }

.seat-list { display: flex; flex-direction: column; gap: 6px; }
.seat { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid var(--paper-2);
  border-left: 5px solid var(--paper-2); border-radius: 4px; background: #fffaf0; }
.seat.me { border-color: var(--gold); }
.seat-num { font-weight: 700; width: 1.2rem; }
.seat-name { flex: 1; }
.swatches { display: flex; gap: 6px; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #0003; }
.swatch.on { outline: 3px solid var(--ink); outline-offset: 1px; }

.room { height: 100%; display: flex; flex-direction: column; }
.room-bar { display: flex; gap: 1rem; align-items: center; padding: 0.3rem 0.8rem; background: #241708; color: var(--paper); font-size: 0.85rem; }
.room-bar a { color: var(--paper); }
.room-bar > :last-child { margin-left: auto; }
.table { flex: 1; min-height: 0; color: var(--paper); }
```

- [ ] **Step 7: Скрипты проверки**

```bash
mkdir -p scripts
cp ../ancient-greece/scripts/net-test.mjs ../ancient-greece/scripts/shot.mjs scripts/
```
В `scripts/net-test.mjs` заменить все `waitForSelector('.map'` на `waitForSelector('.table, .seat-list'` для игрока A (хост сразу попадает в лобби со списком мест) и на `waitForSelector('.seat-list'` там, где ждётся экран занятия места игроком B (он уже совпадает). Открыть `scripts/shot.mjs`, заменить селекторы «Киклад» (`.map` и др.) на `.table`, адреса оставить.

- [ ] **Step 8: Установка, сборка, тест по сети**

```bash
npm install
npm run build
```
Expected: сборка всех трёх пакетов без ошибок.

В отдельном терминале: `npm run dev:server`; во втором: `npm run dev:client`. Затем:
```bash
node scripts/net-test.mjs http://localhost:5173
```
Expected: `home rendered`, `created match …`, `B joined …`, `A joined indicator: Игроки: 2/…`, `no page errors`.

Вручную: открыть `http://localhost:5173/#/local`, выбрать 2 игрока, назначить цвета, «Начать игру» → видна надпись «Поле в разработке. Ходит: …».

- [ ] **Step 9: Commit**

```bash
git add packages/server packages/client scripts package.json package-lock.json
git commit -m "Сервер, лобби, комната и хотсит клиента

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Склейка поля и вырезка жетонов

Исследовательская задача: точные координаты фрагментов и жетонов определяются по превью, поэтому в плане даны скрипты и формат данных, а числа заполняются на шаге 3 и 6.

**Files:**
- Create: `tools/assets/preview_print.py`, `tools/assets/build_board.py`, `tools/assets/board_layout.json`, `tools/assets/build_tokens.py`, `tools/assets/tokens.json`, `packages/client/public/board.webp`, `packages/client/public/tokens/*.webp`
- Modify (если нужно): `packages/engine/src/data/areas.ts` — только соседство, если оно не совпало с полем (тогда перезапустить `npm test`).

**Interfaces:**
- Produces: `public/board.webp` (целое поле, без полос жетонов и белых швов, ширина 3000–4500 px); `public/tokens/minion-{red,yellow,green,blue}.webp`, `building-{red,yellow,green,blue}.webp`, `trouble.webp`, `demon.webp`, `troll.webp` — с прозрачным фоном.

В `source/для_распечатки.pdf` 33 страницы A4. Страницы с индексами 20–27 (с нуля) — 8 фрагментов поля, повёрнутых на 90°, справа у каждого полоса жетонов (миньоны и здания одного цвета, жетоны беспорядка/демонов/троллей, монеты). Страницы 28–30 — жетоны, 31–32 — памятки.

- [ ] **Step 1: Скрипт превью**

`tools/assets/preview_print.py`:
```python
"""Рендерит страницы для_распечатки.pdf в tools/assets/preview/ для ручного разбора."""
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tools' / 'assets' / 'preview'
OUT.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')
for i in range(20, 31):
    doc[i].get_pixmap(dpi=60).save(OUT / f'page-{i}.png')
print('ok', OUT)
```
```bash
PYTHONIOENCODING=utf-8 python tools/assets/preview_print.py
```

- [ ] **Step 2: Разобрать раскладку**

Открыть `tools/assets/preview/page-20.png … page-27.png`. Для каждого фрагмента определить: угол поворота, при котором надписи читаются (90 или 270), прямоугольник карты без полосы жетонов и белых полей (в пикселях повёрнутого рендера при `dpi` из layout), и место фрагмента на итоговом холсте. Сверить по номерам районов 1–12 и реке Анк, что фрагменты стыкуются.

- [ ] **Step 3: Записать `board_layout.json`**

Формат (числа — из шага 2; `crop` и `at` в пикселях при указанном `dpi`):
```json
{
  "dpi": 110,
  "canvas": [4000, 2800],
  "pieces": [
    { "page": 20, "rotate": 90, "crop": [0, 0, 1000, 1400], "at": [0, 0] }
  ]
}
```
В `pieces` — восемь записей, по одной на страницы 20–27.

- [ ] **Step 4: Скрипт склейки**

`tools/assets/build_board.py`:
```python
"""Склеивает поле из фрагментов для_распечатки.pdf по board_layout.json."""
import json
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tools' / 'assets'
layout = json.loads((HERE / 'board_layout.json').read_text(encoding='utf-8'))
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')

canvas = Image.new('RGB', tuple(layout['canvas']), 'white')
for piece in layout['pieces']:
    pix = doc[piece['page']].get_pixmap(dpi=layout['dpi'])
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    img = img.rotate(piece['rotate'], expand=True)
    canvas.paste(img.crop(tuple(piece['crop'])), tuple(piece['at']))

canvas.save(ROOT / 'packages' / 'client' / 'public' / 'board.webp', 'WEBP', quality=82)
(HERE / 'preview').mkdir(exist_ok=True)
canvas.resize((canvas.width // 4, canvas.height // 4)).save(HERE / 'preview' / 'board-small.png')
print('board', canvas.size)
```

- [ ] **Step 5: Собрать и проверить поле**

```bash
PYTHONIOENCODING=utf-8 python tools/assets/build_board.py
```
Открыть `tools/assets/preview/board-small.png`. Критерии приёмки: река непрерывна, все 12 номеров районов видны, нет белых швов и полос жетонов, нет перекрытия с видимым сдвигом. Повторять шаги 3–5, пока критерии не выполнены.

Сверить соседство районов на поле с таблицей в `packages/engine/src/data/areas.ts` (граница или мост). При расхождении исправить `adjacent` симметрично и прогнать `npm test`.

- [ ] **Step 6: Рамки жетонов**

По превью страниц 20–30 выбрать по одному экземпляру каждого жетона и записать `tools/assets/tokens.json` (координаты — в пикселях повёрнутого рендера при `dpi`):
```json
{
  "dpi": 200,
  "tokens": {
    "minion-red": { "page": 25, "rotate": 90, "crop": [0, 0, 80, 80] }
  }
}
```
Ключи: `minion-red`, `minion-yellow`, `minion-green`, `minion-blue`, `building-red`, `building-yellow`, `building-green`, `building-blue`, `trouble`, `demon`, `troll` (11 штук).

- [ ] **Step 7: Скрипт жетонов**

`tools/assets/build_tokens.py`:
```python
"""Вырезает жетоны по tokens.json, делает белый фон прозрачным."""
import json
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tools' / 'assets'
cfg = json.loads((HERE / 'tokens.json').read_text(encoding='utf-8'))
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')
OUT = ROOT / 'packages' / 'client' / 'public' / 'tokens'
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED = {f'{k}-{c}' for k in ('minion', 'building') for c in ('red', 'yellow', 'green', 'blue')} | {'trouble', 'demon', 'troll'}

pages: dict[tuple[int, int], Image.Image] = {}
for name, t in cfg['tokens'].items():
    key = (t['page'], t['rotate'])
    if key not in pages:
        pix = doc[t['page']].get_pixmap(dpi=cfg['dpi'])
        pages[key] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).rotate(t['rotate'], expand=True)
    img = pages[key].crop(tuple(t['crop'])).convert('RGBA')
    img.putdata([(r, g, b, 0) if r > 235 and g > 235 and b > 235 else (r, g, b, a) for r, g, b, a in img.getdata()])
    img.save(OUT / f'{name}.webp', 'WEBP', quality=90)

missing = EXPECTED - set(cfg['tokens'])
assert not missing, f'Не хватает жетонов: {sorted(missing)}'
print('tokens', len(cfg['tokens']))
```
```bash
PYTHONIOENCODING=utf-8 python tools/assets/build_tokens.py
```
Expected: `tokens 11`. Открыть несколько `packages/client/public/tokens/*.webp`: жетон целиком, без соседних элементов, фон прозрачный.

- [ ] **Step 8: Commit**

```bash
git add tools/assets packages/client/public/board.webp packages/client/public/tokens packages/engine/src/data/areas.ts
git commit -m "Поле, склеенное из листов для печати, и жетоны

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Разметка районов на поле

**Files:**
- Modify: `packages/client/src/dev/AreaEditor.tsx` (полная версия)
- Create: `packages/client/src/table/areas.json`

**Interfaces:**
- Produces: `areas.json` формата `{ "width": number, "height": number, "areas": { "1": { "points": [[x, y], ...], "anchor": [x, y] }, ... "12": {...} } }` в пикселях `board.webp`. `anchor` — точка, вокруг которой рисуются фишки (свободное место в районе, не на номере и цене).

- [ ] **Step 1: Начальный файл геометрии**

`packages/client/src/table/areas.json`:
```json
{ "width": 0, "height": 0, "areas": {} }
```

- [ ] **Step 2: Редактор**

`packages/client/src/dev/AreaEditor.tsx`:
```tsx
import { useState } from 'react';
import initial from '../table/areas.json';
import { AREAS } from '@am/engine';
import { BOARD } from '../table/assets';

type Pt = [number, number];
interface AreaGeom { points: Pt[]; anchor: Pt }
interface Geometry { width: number; height: number; areas: Record<string, AreaGeom> }

/**
 * Разметка районов: клик — точка контура текущего района, Shift+клик — якорь фишек.
 * Готовый JSON копируется в packages/client/src/table/areas.json.
 */
export function AreaEditor() {
  const [geo, setGeo] = useState<Geometry>(initial as Geometry);
  const [current, setCurrent] = useState(1);
  const [copied, setCopied] = useState(false);

  function click(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const xy: Pt = [Math.round(p.x), Math.round(p.y)];
    setGeo((g) => {
      const a = g.areas[current] ?? { points: [], anchor: xy };
      const next = e.shiftKey ? { ...a, anchor: xy } : { ...a, points: [...a.points, xy] };
      return { ...g, areas: { ...g.areas, [current]: next } };
    });
  }

  function undoPoint() {
    setGeo((g) => {
      const a = g.areas[current];
      if (!a) return g;
      return { ...g, areas: { ...g.areas, [current]: { ...a, points: a.points.slice(0, -1) } } };
    });
  }

  const json = JSON.stringify(geo);

  return (
    <div className="editor">
      <div className="editor-bar">
        {AREAS.map((a) => (
          <button key={a.id} className={a.id === current ? 'on' : ''} onClick={() => setCurrent(a.id)}>
            {a.id}. {a.name} {geo.areas[a.id]?.points.length ? '✓' : ''}
          </button>
        ))}
        <button onClick={undoPoint}>↶ точка</button>
        <button onClick={() => navigator.clipboard.writeText(json).then(() => setCopied(true))}>
          {copied ? 'Скопировано' : 'Скопировать JSON'}
        </button>
      </div>
      {geo.width > 0 && (
        <svg className="editor-board" viewBox={`0 0 ${geo.width} ${geo.height}`} onClick={click}>
          <image href={BOARD} width={geo.width} height={geo.height} />
          {Object.entries(geo.areas).map(([id, a]) => (
            <g key={id}>
              <polygon points={a.points.map((p) => p.join(',')).join(' ')}
                fill={Number(id) === current ? '#ff000040' : '#0000ff25'} stroke="#000" strokeWidth={3} />
              <circle cx={a.anchor[0]} cy={a.anchor[1]} r={12} fill="#ff0" stroke="#000" strokeWidth={3} />
            </g>
          ))}
        </svg>
      )}
      <img src={BOARD} alt="" style={{ display: 'none' }}
        onLoad={(e) => {
          const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
          setGeo((g) => (g.width ? g : { ...g, width, height }));
        }} />
    </div>
  );
}
```

Добавить в конец `packages/client/src/styles.css`:
```css
.editor { height: 100%; display: flex; flex-direction: column; background: #222; }
.editor-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; }
.editor-bar button.on { background: #ffd54a; }
.editor-board { flex: 1; min-height: 0; width: 100%; cursor: crosshair; }
```

- [ ] **Step 3: Разметить 12 районов**

`npm run dev:client`, открыть `http://localhost:5173/#/dev/areas`. Для каждого района обвести контур по границам (10–30 точек), Shift+клик — якорь в свободном месте района. «Скопировать JSON» → вставить в `packages/client/src/table/areas.json`.

Критерии: у всех 12 районов есть `points` (≥ 3 точек) и `anchor`; контуры не перекрываются заметно; после перезагрузки страницы разметка видна поверх поля.

- [ ] **Step 4: Проверка JSON**

```bash
node -e "const g=require('./packages/client/src/table/areas.json'); const ids=Object.keys(g.areas); if(ids.length!==12||ids.some(i=>g.areas[i].points.length<3)) throw new Error('разметка неполная'); console.log('ok', g.width, g.height)"
```
Expected: `ok <ширина> <высота>`.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/dev packages/client/src/table/areas.json packages/client/src/styles.css
git commit -m "Редактор и разметка районов на поле

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Игровой стол: поле, рука, розыгрыш символов, игроки, лог

**Files:**
- Create: `packages/client/src/table/{BoardView.tsx,Hand.tsx,ActionPanel.tsx,PlayersPanel.tsx,LogPanel.tsx}`
- Modify: `packages/client/src/table/Table.tsx` (полная замена), `packages/client/src/styles.css`

**Interfaces:**
- Consumes: из `@am/engine` — `AMState`, `AreaId`, `Target`, `AREA_IDS`, `areaDef`, `CARD_BY_ID`, `EVENT_BY_ID`, `currentSymbol`, `canEndTurn`, `legalMinionAreas`, `areasWithMinionsOf`, `buildableAreas`, `assassinationAreas`, `assassinationTargets`, `troubleAreas`, `deckSize`, `eventsLeft`, `HIDDEN_CARD`; из `assets.ts` — всё.
- Produces:
  - `BoardView({ G, highlight: AreaId[], selected: AreaId | null, onArea: (id: AreaId) => void })`
  - `Hand({ G, me, canPlay: boolean, onPlay: (cardId: string) => void })`
  - `ActionPanel({ G, ctx, me, moves, undo, nameOf, from, setFrom })`
  - `PlayersPanel({ G, ctx, nameOf })`, `LogPanel({ log: string[] })`
  - `Table` с состояниями `manualOn`, `from`, `menuArea`; в Task 12 добавляются `ManualPanel`, `ManualAreaMenu`, `GameOverPanel`.

- [ ] **Step 1: Поле**

`packages/client/src/table/BoardView.tsx`:
```tsx
import { AREA_IDS, type AMState, type AreaId, type Color } from '@am/engine';
import geometry from './areas.json';
import { BOARD, DEMON, TROLL, TROUBLE, tokenImg } from './assets';

interface Geometry { width: number; height: number; areas: Record<string, { points: number[][]; anchor: number[] }> }
const GEO = geometry as Geometry;
const S = GEO.width / 36; // размер жетона

export function BoardView({ G, highlight, selected, onArea }: {
  G: AMState; highlight: AreaId[]; selected: AreaId | null; onArea: (id: AreaId) => void;
}) {
  const colorOf = (pid: string): Color => G.players[pid]?.color ?? 'red';
  return (
    <svg className="board" viewBox={`0 0 ${GEO.width} ${GEO.height}`} preserveAspectRatio="xMidYMid meet">
      <image href={BOARD} width={GEO.width} height={GEO.height} />
      {AREA_IDS.map((id) => {
        const g = GEO.areas[id];
        if (!g) return null;
        const cls = ['area', highlight.includes(id) ? 'hl' : '', selected === id ? 'sel' : ''].join(' ');
        return <polygon key={id} className={cls} points={g.points.map((p) => p.join(',')).join(' ')}
          onClick={() => highlight.includes(id) && onArea(id)} />;
      })}
      {AREA_IDS.map((id) => <AreaPieces key={id} G={G} id={id} colorOf={colorOf} />)}
    </svg>
  );
}

function AreaPieces({ G, id, colorOf }: { G: AMState; id: AreaId; colorOf: (pid: string) => Color }) {
  const g = GEO.areas[id];
  if (!g) return null;
  const a = G.areas[id];
  const items: { href: string; key: string; count?: number }[] = [];
  if (a.building) items.push({ href: tokenImg('building', colorOf(a.building)), key: 'b' });
  for (const [pid, n] of Object.entries(a.minions)) if (n > 0) items.push({ href: tokenImg('minion', colorOf(pid)), key: `m${pid}`, count: n });
  if (a.demons) items.push({ href: DEMON, key: 'd', count: a.demons });
  if (a.trolls) items.push({ href: TROLL, key: 't', count: a.trolls });
  if (a.trouble) items.push({ href: TROUBLE, key: 'x' });
  const [cx, cy] = g.anchor;
  const cols = Math.min(3, items.length);
  return (
    <g pointerEvents="none">
      {items.map((it, i) => {
        const x = cx + ((i % 3) - (cols - 1) / 2) * S * 1.05 - S / 2;
        const y = cy + Math.floor(i / 3) * S * 1.05 - S / 2;
        return (
          <g key={it.key}>
            <image href={it.href} x={x} y={y} width={S} height={S} />
            {it.count && it.count > 1 && (
              <text className="piece-count" x={x + S} y={y + S} fontSize={S * 0.5} textAnchor="end">×{it.count}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}
```

- [ ] **Step 2: Рука, игроки, лог**

`packages/client/src/table/Hand.tsx`:
```tsx
import { CARD_BY_ID, HIDDEN_CARD, type AMState } from '@am/engine';
import { cardImg } from './assets';

export function Hand({ G, me, canPlay, onPlay }: {
  G: AMState; me: string | null; canPlay: boolean; onPlay: (cardId: string) => void;
}) {
  const hand = me ? G.players[me]?.hand ?? [] : [];
  return (
    <div className="hand">
      {hand.filter((c) => c !== HIDDEN_CARD).map((id, i) => (
        <button key={`${id}-${i}`} className="hand-card" disabled={!canPlay} onClick={() => onPlay(id)}
          title={CARD_BY_ID[id]?.name}>
          <img src={cardImg(id)} alt={CARD_BY_ID[id]?.name ?? id} />
        </button>
      ))}
      {hand.length === 0 && <div className="hand-empty">Рука пуста</div>}
    </div>
  );
}
```

`packages/client/src/table/PlayersPanel.tsx`:
```tsx
import { AREA_IDS, areaDef, type AMState } from '@am/engine';
import { COLOR_HEX, districtImg } from './assets';

export function PlayersPanel({ G, ctx, nameOf }: { G: AMState; ctx: any; nameOf: (pid: string) => string }) {
  const order: string[] = Array.from({ length: ctx.numPlayers }, (_, i) => ctx.playOrder[(G.startIndex + i) % ctx.numPlayers]);
  return (
    <section className="players">
      {order.map((pid) => {
        const p = G.players[pid];
        const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id].minions[pid], 0);
        const districts = AREA_IDS.filter((id) => G.areas[id].building === pid);
        return (
          <div key={pid} className={`player ${ctx.currentPlayer === pid ? 'current' : ''}`}
            style={{ borderLeftColor: p.color ? COLOR_HEX[p.color] : undefined }}>
            <div className="player-head">
              <b>{nameOf(pid)}</b>
              <span className="money">${p.money}</span>
              {p.loans > 0 && <span className="loans" title="Займы">займ ×{p.loans}</span>}
            </div>
            <div className="player-stats">
              🂠 {p.hand.length} · слуги {onBoard}/{onBoard + p.minionSupply} · здания {6 - p.buildingSupply}/6
            </div>
            {districts.length > 0 && (
              <div className="player-districts">
                {districts.map((id) => <img key={id} src={districtImg(id)} alt={areaDef(id).name} title={areaDef(id).name} />)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

`packages/client/src/table/LogPanel.tsx`:
```tsx
export function LogPanel({ log }: { log: string[] }) {
  return (
    <section className="log">
      {log.slice(-60).reverse().map((line, i) => <div key={log.length - i}>{line}</div>)}
    </section>
  );
}
```

- [ ] **Step 3: Панель действия**

`packages/client/src/table/ActionPanel.tsx`:
```tsx
import { CARD_BY_ID, EVENT_BY_ID, canEndTurn, currentSymbol, deckSize, eventsLeft, type AMState, type CardSymbol } from '@am/engine';
import { cardImg, eventImg, BACK_PLAY } from './assets';

const LABEL: Record<CardSymbol['kind'], string> = {
  minion: 'Поставить слугу', building: 'Построить здание', assassinate: 'Убийство',
  removeTrouble: 'Убрать беспорядок', money: 'Взять деньги', scroll: 'Текст карты',
  event: 'Случайное событие', playAnother: 'Сыграть ещё карту', interrupt: 'Прерывание',
};

const label = (s: CardSymbol) => (s.kind === 'money' ? `Взять $${s.amount}` : LABEL[s.kind]);

export function ActionPanel({ G, ctx, me, moves, undo, nameOf, from }: {
  G: AMState; ctx: any; me: string | null; moves: any; undo: () => void;
  nameOf: (pid: string) => string; from: number | null;
}) {
  const myTurn = me === ctx.currentPlayer && !ctx.gameover;
  const sym = currentSymbol(G);
  const top = G.discard.at(-1);

  return (
    <section className="action">
      <div className="piles">
        <span>Колода: {deckSize(G)}</span>
        <span>События: {eventsLeft(G)}</span>
        <span className="discard-top">Сброс: {top ? <img src={cardImg(top)} alt={CARD_BY_ID[top]?.name} title={CARD_BY_ID[top]?.name} /> : <img src={BACK_PLAY} alt="" className="dim" />}</span>
      </div>

      {G.play && (
        <div className="in-play">
          <img className="in-play-card" src={cardImg(G.play.cardId)} alt={CARD_BY_ID[G.play.cardId]?.name} />
          <ol className="queue">
            {G.play.queue.map((s, i) => <li key={i} className={i === 0 ? 'now' : ''}>{label(s)}</li>)}
          </ol>
        </div>
      )}

      {G.lastEvent && (
        <div className="event">
          <img src={eventImg(G.lastEvent)} alt={EVENT_BY_ID[G.lastEvent]?.name} />
          <div>Событие «{EVENT_BY_ID[G.lastEvent]?.name}»: выполните его вручную (✋).</div>
        </div>
      )}

      {!myTurn && <div className="hint">Ходит {nameOf(ctx.currentPlayer)}…</div>}

      {myTurn && sym && (
        <div className="hint">
          {(sym.kind === 'minion' || sym.kind === 'building') && (from == null
            ? <>Выберите район на поле. {sym.kind === 'minion' && G.players[me!].minionSupply === 0 && 'Все слуги на поле — сначала выберите, кого переставить.'}{sym.kind === 'building' && G.players[me!].buildingSupply === 0 && 'Все здания на поле — сначала выберите, какое перенести.'}</>
            : <>Теперь выберите, куда.</>)}
          {sym.kind === 'assassinate' && 'Выберите район с беспорядком, затем жертву.'}
          {sym.kind === 'removeTrouble' && 'Выберите район с жетоном беспорядка.'}
          {(sym.kind === 'scroll' || sym.kind === 'interrupt') && 'Выполните текст карты вручную (✋), затем нажмите «Готово».'}
          <div className="buttons">
            {sym.kind === 'money' && <button className="btn" onClick={() => moves.takeMoney()}>{label(sym)}</button>}
            {sym.kind === 'playAnother' && <button className="btn" onClick={() => moves.playAnother()}>Можно сыграть ещё карту</button>}
            {sym.kind === 'event' && <button className="btn" onClick={() => moves.drawEvent()}>Тянуть событие</button>}
            {(sym.kind === 'scroll' || sym.kind === 'interrupt') && <button className="btn" onClick={() => moves.skipSymbol()}>Готово</button>}
            {sym.kind !== 'event' && sym.kind !== 'scroll' && sym.kind !== 'interrupt' && (
              <button className="btn ghost" onClick={() => moves.skipSymbol()}>Пропустить</button>
            )}
          </div>
        </div>
      )}

      {myTurn && !G.play && (
        <div className="hint">
          {G.playsLeft > 0 ? (G.cardsPlayed === 0 ? 'Сыграйте карту из руки.' : 'Можно сыграть ещё одну карту.') : 'Карты сыграны.'}
          <div className="buttons">
            <button className="btn" disabled={!!canEndTurn(G, me!)} onClick={() => moves.finishTurn()}>Закончить ход</button>
          </div>
        </div>
      )}

      {myTurn && <button className="btn ghost undo" onClick={() => undo()}>↶ Отменить</button>}
    </section>
  );
}
```

- [ ] **Step 4: Стол (полная замена `Table.tsx`)**

`packages/client/src/table/Table.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import {
  areasWithMinionsOf, assassinationAreas, assassinationTargets, buildableAreas, currentSymbol,
  legalMinionAreas, troubleAreas, AREA_IDS, type AMState, type AreaId, type Target,
} from '@am/engine';
import { Lobby } from './Lobby';
import { BoardView } from './BoardView';
import { Hand } from './Hand';
import { ActionPanel } from './ActionPanel';
import { PlayersPanel } from './PlayersPanel';
import { LogPanel } from './LogPanel';
import { personalityImg } from './assets';

interface MatchPlayer { id: number; name?: string }

export function NetBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.playerID} matchData={p.matchData as MatchPlayer[] | undefined} />;
}

export function HotseatBoard(p: BoardProps<AMState>) {
  return <Table G={p.G} ctx={p.ctx} moves={p.moves} undo={p.undo} me={p.ctx.currentPlayer} />;
}

export interface TableProps {
  G: AMState; ctx: any; moves: any; undo: () => void; me: string | null; matchData?: MatchPlayer[];
}

export function Table({ G, ctx, moves, undo, me, matchData }: TableProps) {
  const [manualOn, setManualOn] = useState(false);
  const [from, setFrom] = useState<AreaId | null>(null);
  const [menuArea, setMenuArea] = useState<AreaId | null>(null);

  const nameOf = (pid: string) =>
    matchData?.find((m) => String(m.id) === pid)?.name || G.players[pid]?.name || `Игрок ${Number(pid) + 1}`;

  useEffect(() => {
    if (ctx.phase !== 'lobby' || !me || !matchData) return;
    const n = matchData.find((m) => String(m.id) === me)?.name;
    if (n && G.players[me]?.name !== n) moves.setName(n);
  }, [ctx.phase, me, matchData, G.players, moves]);

  // Сброс выбора при смене символа или хода.
  const sym = currentSymbol(G);
  useEffect(() => { setFrom(null); setMenuArea(null); }, [sym?.kind, G.play?.queue.length, ctx.turn]);

  if (ctx.phase === 'lobby') return <Lobby G={G} ctx={ctx} me={me} moves={moves} nameOf={nameOf} />;

  const myTurn = me === ctx.currentPlayer && !ctx.gameover;
  const mine = me ? G.players[me] : null;

  let highlight: AreaId[] = [];
  let onArea: (id: AreaId) => void = () => {};
  if (myTurn && manualOn) {
    highlight = AREA_IDS;
    onArea = (id) => setMenuArea(id);
  } else if (myTurn && sym && me && mine) {
    if (sym.kind === 'minion') {
      if (mine.minionSupply > 0) { highlight = legalMinionAreas(G, me); onArea = (id) => moves.placeMinion(id); }
      else if (from == null) { highlight = areasWithMinionsOf(G, me); onArea = setFrom; }
      else { highlight = legalMinionAreas(G, me).filter((id) => id !== from); onArea = (id) => moves.placeMinion(id, from); }
    } else if (sym.kind === 'building') {
      if (mine.buildingSupply > 0) { highlight = buildableAreas(G, me); onArea = (id) => moves.build(id); }
      else if (from == null) { highlight = AREA_IDS.filter((id) => G.areas[id].building === me); onArea = setFrom; }
      else { highlight = buildableAreas(G, me); onArea = (id) => moves.build(id, from); }
    } else if (sym.kind === 'assassinate') {
      highlight = assassinationAreas(G, me);
      onArea = setMenuArea;
    } else if (sym.kind === 'removeTrouble') {
      highlight = troubleAreas(G);
      onArea = (id) => moves.removeTrouble(id);
    }
  }

  const targetName = (t: Target) => (t.kind === 'minion' ? `Слуга: ${nameOf(t.owner)}` : t.kind === 'demon' ? 'Демон' : 'Тролль');

  return (
    <div className="table">
      <div className="table-board">
        <BoardView G={G} highlight={highlight} selected={from ?? menuArea} onArea={onArea} />
      </div>
      <aside className="table-side">
        <PlayersPanel G={G} ctx={ctx} nameOf={nameOf} />
        <ActionPanel G={G} ctx={ctx} me={me} moves={moves} undo={undo} nameOf={nameOf} from={from} />
        <LogPanel log={G.log} />
      </aside>
      <footer className="table-foot">
        <Hand G={G} me={me} canPlay={myTurn && !G.play && G.playsLeft > 0 && !manualOn} onPlay={(id) => moves.playCard(id)} />
        {mine?.personality && <img className="personality" src={personalityImg(mine.personality)} alt="Ваша личность" title="Ваша личность (видна только вам)" />}
      </footer>

      {menuArea != null && !manualOn && sym?.kind === 'assassinate' && me && (
        <div className="popup" onClick={() => setMenuArea(null)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h3>Кого убрать?</h3>
            {assassinationTargets(G, me, menuArea).map((t, i) => (
              <button key={i} className="btn" onClick={() => { moves.assassinate(menuArea, t); setMenuArea(null); }}>{targetName(t)}</button>
            ))}
            <button className="btn ghost" onClick={() => setMenuArea(null)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
```
Переменная `setManualOn` пока не используется в разметке — её подключает Task 12. Чтобы `tsc` не ругался на неиспользуемую переменную, ничего делать не нужно: `noUnusedLocals` в `tsconfig.base.json` не включён.

- [ ] **Step 5: Стили стола**

Добавить в конец `packages/client/src/styles.css`:
```css
.table { display: grid; grid-template-columns: 1fr 340px; grid-template-rows: 1fr auto; height: 100%;
  background: #2a1d10; color: var(--ink); }
.table-board { min-height: 0; display: flex; }
.board { width: 100%; height: 100%; }
.area { fill: transparent; stroke: none; }
.area.hl { fill: #ffe06640; stroke: #ffd000; stroke-width: 6; cursor: pointer; }
.area.hl:hover { fill: #ffe06680; }
.area.sel { fill: #ff6a0060; stroke: #ff6a00; stroke-width: 8; }
.piece-count { fill: #fff; stroke: #000; stroke-width: 4; paint-order: stroke; font-weight: 700; }

.table-side { grid-row: 1 / 3; grid-column: 2; display: flex; flex-direction: column; gap: 8px; padding: 8px;
  background: var(--paper); overflow: hidden; }
.players { display: flex; flex-direction: column; gap: 5px; }
.player { border: 1px solid var(--paper-2); border-left: 6px solid var(--paper-2); border-radius: 4px; padding: 4px 8px; background: #fffaf0; }
.player.current { box-shadow: 0 0 0 2px var(--gold); }
.player-head { display: flex; gap: 8px; align-items: baseline; }
.player-head .money { margin-left: auto; font-weight: 700; }
.loans { color: var(--red); font-size: 0.8rem; }
.player-stats { font-size: 0.8rem; opacity: 0.8; }
.player-districts { display: flex; gap: 3px; margin-top: 3px; }
.player-districts img { height: 38px; border-radius: 3px; }

.action { display: flex; flex-direction: column; gap: 6px; }
.piles { display: flex; gap: 10px; align-items: center; font-size: 0.85rem; }
.discard-top img { height: 40px; vertical-align: middle; border-radius: 3px; }
.dim { opacity: 0.3; }
.in-play { display: flex; gap: 8px; }
.in-play-card { width: 120px; border-radius: 6px; box-shadow: var(--shadow); }
.queue { margin: 0; padding-left: 1.2rem; font-size: 0.9rem; }
.queue li.now { font-weight: 700; color: var(--red); }
.event { display: flex; gap: 8px; align-items: center; font-size: 0.85rem; }
.event img { width: 70px; border-radius: 4px; }
.hint { font-size: 0.9rem; }
.buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.undo { align-self: flex-start; }
.log { flex: 1; min-height: 0; overflow-y: auto; font-size: 0.8rem; border-top: 1px solid var(--paper-2); padding-top: 4px; }

.table-foot { grid-column: 1; display: flex; align-items: flex-end; gap: 12px; padding: 6px 10px; background: #1d140a; }
.hand { display: flex; gap: 6px; flex: 1; }
.hand-card { padding: 0; border: none; background: none; transition: transform 0.15s; }
.hand-card img { height: 150px; border-radius: 6px; box-shadow: var(--shadow); display: block; }
.hand-card:not(:disabled):hover { transform: translateY(-40px) scale(1.6); z-index: 2; position: relative; }
.hand-card:disabled { opacity: 1; }
.hand-empty { color: var(--paper); opacity: 0.6; }
.personality { height: 150px; border-radius: 6px; box-shadow: var(--shadow); }

.popup { position: fixed; inset: 0; background: #0007; display: flex; align-items: center; justify-content: center; z-index: 10; }
.popup-box { background: var(--paper); border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; gap: 6px; min-width: 260px; }
.popup-box h3 { margin: 0 0 4px; }
```

- [ ] **Step 6: Сборка и ручная проверка в хотсите**

```bash
npm run build -w packages/client
```
Expected: без ошибок. Затем `npm run dev:client`, открыть `http://localhost:5173/#/local`, 2 игрока, цвета, старт. Проверить:
1. Поле видно целиком, фишки стоят в Сестрах Долли, Сточной улице и Тенях, там же жетоны беспорядка.
2. Клик по карте в руке → карта появляется в панели, очередь символов подсвечена.
3. Символ «слуга» → подсвечены только допустимые районы; клик ставит слугу (и беспорядок, если там уже кто-то есть).
4. «Взять $N», «Тянуть событие», «Готово» и «Пропустить» работают; событие пропустить нельзя (кнопки нет).
5. «Закончить ход» → рука добирается до 5, ход у другого игрока, его рука и личность видны (хотсит).
6. «↶ Отменить» откатывает сыгранную карту.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src
git commit -m "Игровой стол: поле с фишками, рука, розыгрыш символов, игроки и лог

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Ручной режим и экран конца игры

**Files:**
- Create: `packages/client/src/table/ManualPanel.tsx`, `packages/client/src/table/GameOverPanel.tsx`
- Modify: `packages/client/src/table/Table.tsx`, `packages/client/src/styles.css`

**Interfaces:**
- Consumes: `ManualAction`, `CARD_BY_ID`, `PERSONALITY_BY_ID`, `areaDef`, `MAX_DEMONS`, `MAX_TROLLS` из `@am/engine`.
- Produces: `ManualPanel({ G, me, moves, nameOf, on, setOn })`, `ManualAreaMenu({ G, area, moves, nameOf, onClose })`, `GameOverPanel({ G, nameOf })`.

- [ ] **Step 1: Ручной режим**

`packages/client/src/table/ManualPanel.tsx`:
```tsx
import { useState } from 'react';
import { CARD_BY_ID, HIDDEN_CARD, areaDef, type AMState, type AreaId, type ManualAction } from '@am/engine';

export function ManualPanel({ G, me, moves, nameOf, on, setOn }: {
  G: AMState; me: string; moves: any; nameOf: (pid: string) => string; on: boolean; setOn: (v: boolean) => void;
}) {
  const pids = Object.keys(G.players);
  const [from, setFrom] = useState<string>('bank');
  const [to, setTo] = useState<string>(me);
  const [amount, setAmount] = useState(1);
  const [card, setCard] = useState('');
  const [giveTo, setGiveTo] = useState(pids.find((p) => p !== me) ?? me);
  const [fromDiscard, setFromDiscard] = useState('');
  const hand = G.players[me].hand.filter((c) => c !== HIDDEN_CARD);
  const act = (a: ManualAction) => moves.manual(a);
  const who = (p: string) => (p === 'bank' ? 'Банк' : nameOf(p));

  return (
    <div className={`manual ${on ? 'on' : ''}`}>
      <button className="btn" onClick={() => setOn(!on)}>✋ {on ? 'Выйти из ручного режима' : 'Ручной режим'}</button>
      {on && (
        <div className="manual-body">
          <div className="manual-hint">Клик по району — фишки и беспорядки. Всё пишется в лог.</div>
          <div className="manual-row">
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {['bank', ...pids].map((p) => <option key={p} value={p}>{who(p)}</option>)}
            </select>
            →
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {['bank', ...pids].map((p) => <option key={p} value={p}>{who(p)}</option>)}
            </select>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <button className="btn small" onClick={() => act({ type: 'money', from, to, amount })}>$ Перевести</button>
          </div>
          <div className="manual-row">
            Займы {nameOf(me)}: {G.players[me].loans}
            <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: -1 })}>−</button>
            <button className="btn small" onClick={() => moves.manualDraw()}>Взять карту из колоды</button>
          </div>
          <div className="manual-row">
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">— карта из руки —</option>
              {hand.map((c, i) => <option key={`${c}-${i}`} value={c}>{CARD_BY_ID[c]?.name ?? c}</option>)}
            </select>
            <button className="btn small" disabled={!card} onClick={() => { act({ type: 'discard', cardId: card }); setCard(''); }}>Сбросить</button>
            <select value={giveTo} onChange={(e) => setGiveTo(e.target.value)}>
              {pids.filter((p) => p !== me).map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
            </select>
            <button className="btn small" disabled={!card} onClick={() => { act({ type: 'give', cardId: card, to: giveTo }); setCard(''); }}>Передать</button>
          </div>
          <div className="manual-row">
            <select value={fromDiscard} onChange={(e) => setFromDiscard(e.target.value)}>
              <option value="">— карта из сброса —</option>
              {[...new Set(G.discard)].reverse().map((c) => <option key={c} value={c}>{CARD_BY_ID[c]?.name ?? c}</option>)}
            </select>
            <button className="btn small" disabled={!fromDiscard} onClick={() => { act({ type: 'takeDiscard', cardId: fromDiscard }); setFromDiscard(''); }}>Взять из сброса</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ManualAreaMenu({ G, area, moves, nameOf, onClose }: {
  G: AMState; area: AreaId; moves: any; nameOf: (pid: string) => string; onClose: () => void;
}) {
  const a = G.areas[area];
  const act = (x: ManualAction) => moves.manual(x);
  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>✋ {areaDef(area).name}</h3>
        {Object.keys(G.players).map((pid) => (
          <div key={pid} className="manual-row">
            <span className="grow">Слуги {nameOf(pid)}: {a.minions[pid]}</span>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: -1 })}>−</button>
          </div>
        ))}
        <div className="manual-row">
          <span className="grow">Здание</span>
          <select value={a.building ?? ''} onChange={(e) => act({ type: 'building', area, owner: e.target.value || null })}>
            <option value="">нет</option>
            {Object.keys(G.players).map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
          </select>
        </div>
        <div className="manual-row">
          <span className="grow">Беспорядок: {a.trouble ? 'есть' : 'нет'}</span>
          <button className="btn small" onClick={() => act({ type: 'trouble', area, on: !a.trouble })}>{a.trouble ? 'Убрать' : 'Положить'}</button>
        </div>
        <div className="manual-row">
          <span className="grow">Демоны: {a.demons}</span>
          <button className="btn small" onClick={() => act({ type: 'demon', area, delta: 1 })}>+</button>
          <button className="btn small" onClick={() => act({ type: 'demon', area, delta: -1 })}>−</button>
        </div>
        <div className="manual-row">
          <span className="grow">Тролли: {a.trolls}</span>
          <button className="btn small" onClick={() => act({ type: 'troll', area, delta: 1 })}>+</button>
          <button className="btn small" onClick={() => act({ type: 'troll', area, delta: -1 })}>−</button>
        </div>
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Конец игры**

`packages/client/src/table/GameOverPanel.tsx`:
```tsx
import { PERSONALITY_BY_ID, type AMState } from '@am/engine';
import { personalityImg } from './assets';

const REASON = {
  personality: 'выполнил условие своей личности',
  vimes: 'колода закончилась — побеждает Командор Ваймс',
  score: 'колода закончилась — победа по очкам',
};

export function GameOverPanel({ G, nameOf }: { G: AMState; nameOf: (pid: string) => string }) {
  const over = G.gameover!;
  return (
    <div className="popup">
      <div className="popup-box gameover">
        <h2>Победа: {over.winner != null ? nameOf(over.winner) : 'ничья'}</h2>
        <p>{REASON[over.reason]}</p>
        <div className="reveal">
          {Object.entries(over.personalities).map(([pid, id]) => (
            <figure key={pid}>
              <img src={personalityImg(id)} alt={PERSONALITY_BY_ID[id]?.name} />
              <figcaption>
                {nameOf(pid)}{over.scores && <> — {over.scores[pid]} очк.</>}
              </figcaption>
            </figure>
          ))}
        </div>
        <a className="btn" href="#/">На главную</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Подключить в `Table.tsx`**

В `packages/client/src/table/Table.tsx`:

Импорты — добавить:
```tsx
import { ManualPanel, ManualAreaMenu } from './ManualPanel';
import { GameOverPanel } from './GameOverPanel';
```

В `<footer className="table-foot">` после картинки личности добавить:
```tsx
{myTurn && me && <ManualPanel G={G} me={me} moves={moves} nameOf={nameOf} on={manualOn} setOn={(v) => { setManualOn(v); setMenuArea(null); }} />}
```

Перед закрывающим `</div>` корневого `.table` добавить:
```tsx
{menuArea != null && manualOn && (
  <ManualAreaMenu G={G} area={menuArea} moves={moves} nameOf={nameOf} onClose={() => setMenuArea(null)} />
)}
{G.gameover && <GameOverPanel G={G} nameOf={nameOf} />}
```

И выключать ручной режим при смене хода: сразу под существующим `useEffect` сброса выбора (обязательно **до** строки `if (ctx.phase === 'lobby') return …`, иначе нарушится порядок хуков React) добавить:
```tsx
useEffect(() => { setManualOn(false); }, [ctx.turn]);
```

- [ ] **Step 4: Стили**

Добавить в конец `packages/client/src/styles.css`:
```css
.manual { display: flex; flex-direction: column; gap: 6px; color: var(--paper); max-width: 520px; }
.manual.on { background: #3b2a16; padding: 6px; border-radius: 6px; }
.manual-body { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; }
.manual-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.manual-row input { width: 4rem; }
.manual-row .grow { flex: 1; }
.manual-hint { opacity: 0.75; }
.popup-box .manual-row { color: var(--ink); }
.gameover { max-width: 760px; text-align: center; align-items: center; }
.reveal { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.reveal img { height: 200px; border-radius: 6px; }
.reveal figcaption { font-size: 0.9rem; }
```

- [ ] **Step 5: Сборка и ручная проверка**

```bash
npm run build -w packages/client
```
Expected: без ошибок. В хотсите на 2 игрока проверить:
1. «✋ Ручной режим» → клик по любому району открывает меню; +/− слуг, здание, беспорядок, демоны, тролли меняют поле и пишут строку «✋ …» в лог.
2. Перевод денег банк → игрок и игрок → игрок; займ +/−; «Взять карту из колоды»; сбросить/передать/взять из сброса.
3. Карта со свитком: выполнить текст вручную → «Готово» → карта уходит в сброс.
4. Довести партию до конца (быстрее всего — через ручной режим положить 8 беспорядков, если у кого-то Дракон; либо раздать районы лорду) → в начале хода победителя появляется экран с раскрытием всех личностей.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src
git commit -m "Ручной режим и экран конца игры

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Сетевая проверка, скриншоты, деплой

**Files:**
- Create: `render.yaml`, `README.md`
- Modify: `scripts/net-test.mjs` (при необходимости)

**Interfaces:**
- Consumes: всё предыдущее.
- Produces: рабочий деплой на Render и инструкция для игроков.

- [ ] **Step 1: Полный прогон тестов и сборки**

```bash
npm test
npm run build
```
Expected: все тесты PASS, сборка без ошибок.

- [ ] **Step 2: Сетевая проверка скрытой информации**

`npm run play` (собирает клиент и поднимает сервер на 3001). В двух разных браузерных профилях (или обычном + инкогнито) открыть `http://localhost:3001`, создать игру на 2, занять оба места, выбрать цвета, начать. Проверить:
1. Каждый видит свою руку и личность, у соперника — только число карт.
2. В DevTools → Network → WS-сообщения: в состоянии нет чужой `hand` (только `"?"`), `deck: []`, `events: []`.
3. Ходы одного игрока сразу видны второму; «Отменить» у второго не показывается.

Затем:
```bash
node scripts/net-test.mjs http://localhost:3001
```
Expected: `no page errors`.

- [ ] **Step 3: Скриншоты вёрстки**

```bash
node scripts/shot.mjs http://localhost:3001
```
Проверить скриншоты на 1366×768 и 1920×1080: поле, правая панель и рука помещаются без прокрутки страницы, рука не перекрывает поле больше чем на высоту карты.

- [ ] **Step 4: Render**

`render.yaml`:
```yaml
services:
  - type: web
    name: ankh-morpork
    runtime: node
    plan: free
    # Ставим зависимости (включая dev — нужны typescript/vite) и собираем движок, сервер и клиент.
    buildCommand: npm install --include=dev && npm run build
    # Сервер (Koa + socket.io через tsx) раздаёт клиент и держит сокеты.
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: "20"
```

- [ ] **Step 5: README**

`README.md`:
````markdown
# Анк-Морпорк — веб-версия

Браузерная версия настольной игры «Плоский мир: Анк-Морпорк» для игры с друзьями.

## Запуск у себя

```
npm install
npm run play      # http://localhost:3001
```

Разработка: `npm run dev:server` и `npm run dev:client` (http://localhost:5173).

## Игра по сети

Задеплойте на Render (файл `render.yaml`) или откройте локальный сервер наружу:
`ngrok http 3001`. Создайте игру, скопируйте ссылку и отправьте друзьям.

На бесплатном плане Render сервер засыпает после ~15 минут простоя, партии хранятся в памяти.

## Что автоматизировано (веха 1)

Ходы, символы карт (слуга, здание, убийство, беспорядок, деньги, событие, «сыграть ещё»),
беспорядки, контроль, условия победы, финальный подсчёт, отмена в пределах хода.
Тексты карт, способности районов и эффекты событий выполняются вручную через «✋ Ручной режим».

## Ассеты

Исходники (PDF, PSD, таблица перевода, шрифт) лежат в `source/` и не коммитятся.
Пересборка картинок: `python tools/assets/build_cards.py`, `build_board.py`, `build_tokens.py`.
````

- [ ] **Step 6: Commit**

```bash
git add render.yaml README.md scripts
git commit -m "Деплой на Render и README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Публикация (только с разрешения пользователя)**

Создание репозитория на GitHub, push и подключение Render — внешние действия. Спросить пользователя перед ними. Если он согласен: создать приватный репозиторий, `git push`, в Render — New → Blueprint → выбрать репозиторий. Проверить, что ссылка Render открывает главную и игра создаётся.
