# Автоматизация текстов карт — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 70 свитков разыгрываются движком по шагам (соперник отвечает сам), ручной режим умеет всё, отмена работает для шагов без скрытой информации.

**Architecture:** В `G.prompt` хранится текущий вопрос (кто отвечает, вид, варианты). Эффект карты — объект `{ start, answer }` в `engine/src/cards/*.ts`, собранный из помощников `ops.ts`; общий исполнитель `run.ts` валидирует ответы и двигает очередь символов. В фазе `play` активны все игроки (ответ соперника — обычный ход `answer` от его имени), остальные ходы проверяют, что ходит текущий игрок. Клиент показывает плашку подсказки, подсвечивает поле, открывает окна ответа и показа скрытого; в хотсите «сиденье» клиента переключается на отвечающего.

**Tech Stack:** TypeScript, boardgame.io 0.50, React 18, vitest, puppeteer.

**Спецификация:** `docs/superpowers/specs/2026-10-17-card-scrolls-design.md`

## Global Constraints

- Скрытое (руки соперников, порядок колод, неиспользованные личности, `prompt.reveal`, `peek`) не уходит клиенту, которому не положено: всё через `playerView`.
- Ходы со случайностью или открытием скрытого — `client: false`; их отмена запрещена (`undoable: false` или `({ G }) => !G.noUndo`).
- Отменять можно только свои ходы (так устроен boardgame.io 0.50).
- Все тексты интерфейса и лога — на русском; эффекты по текстам русских карт, спорное — по оригиналу и FAQ.
- Карта без эффекта в реестре разыгрывается вручную, как раньше.
- Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Команды — из корня репозитория в Git Bash. После изменений движка перезапускать сервер (`npm run play`): `tsx` без watch.

## Карта файлов

```
packages/engine/src/
  types.ts           — + front, spare, prompt, noUndo, peek, Prompt, GameOver 'manual', CardInPlay.toFront
  setup.ts           — + front, spare, prompt, noUndo, peek
  view.ts            — + скрытие spare, prompt.reveal/options, peek
  rules.ts           — troubleEnter/troubleLeave экспортируются
  turn.ts            — toFront, «застрявшие» карты при доборе, prompt в skipSymbol/canEndTurn, peek в startTurn
  victory.ts         — scoreResult выделен из deckOutResult
  manual.ts          — новые действия + случайные/скрытые функции
  game.ts            — activePlayers ALL + проверка «ходит текущий», новые ходы
  cards/run.ts       — Effect, EffectApi, реестр, startScroll/answerPrompt, валидация
  cards/ops.ts       — фишки (ключи), перемещения, деньги, карты, ask()
  cards/instant.ts   — пачка 1
  cards/hand.ts      — пачка 2
  cards/players.ts   — пачка 3
  cards/board.ts     — пачка 4
  cards/dice.ts      — пачка 5
  cards/respond.ts   — пачка 6
  cards/index.ts     — регистрация всех пачек
  cards/testkit.ts   — сценарий для тестов
  *.test.ts, cards/*.test.ts
packages/client/src/
  LocalGame.tsx                 — сиденье хотсита
  table/Table.tsx               — подсветка по prompt, модалки, SeatContext
  table/PromptBar.tsx           — плашка подсказки
  table/PromptModals.tsx        — выбор фишки, ответ соперника, показ скрытого, передача компьютера
  table/Hand.tsx                — режим выбора карт
  table/ActionPanel.tsx         — свиток через плашку
  table/PlayersPanel.tsx        — зона «перед игроком»
  table/ManualPanel.tsx         — полный ручной режим
  styles.css
scripts/hotseat-test.mjs, scripts/secrecy-test.mjs
```

---

### Task 1: Ручной режим — движок

**Files:**
- Modify: `packages/engine/src/types.ts`, `setup.ts`, `view.ts`, `rules.ts`, `turn.ts`, `victory.ts`, `manual.ts`, `game.ts`, `data/cards.ts`
- Test: `packages/engine/src/manual.test.ts`, `packages/engine/src/game.test.ts`

**Interfaces:**
- Produces:
  - `PlayerState.front: string[]`; `AMState.spare: PersonalityId[]`, `prompt: Prompt | null`, `noUndo: boolean`, `peek: { player: PlayerID; cards: string[] } | null`, `spareCount?: number`; `GameOver.reason` + `'manual'`; `CardInPlay.toFront?: PlayerID`.
  - Типы `PromptKind`, `Choice`, `Prompt` (в `types.ts`, используются в Task 3).
  - `STUCK_CARDS = ['fools-guild', 'drwhiteface']` в `data/cards.ts`.
  - `rules.ts`: `troubleEnter(a)`, `troubleLeave(a)`.
  - `victory.ts`: `scoreResult(G): GameOver`.
  - `manual.ts`: новые `ManualAction`: `movePiece`, `returnToDeck`, `toFront`, `fromFront`, `returnPlayed`, `dropEvent`, `extraPlay`, `declareEnd`; функции `takeRandomCard(G, pid, from, shuffle)`, `eventBack(G, pid, where, shuffle)`, `swapPersonality(G, pid, shuffle)`, `peekSpare(G, pid)`.
  - Ходы `game.ts`: `manualTakeRandom(from)`, `manualEventBack(where)`, `manualSwapPersonality()`, `manualPeekSpare()`, `manualRoll()`, `manualEndTurn()`.

- [ ] **Step 1: Типы**

В `packages/engine/src/types.ts`:

В `PlayerState` после `buildingSupply: number;` добавить:
```ts
  /** Карты, лежащие перед игроком (видны всем): Банк, Мистер Бент, Гильдия шутов… */
  front: string[];
```

`CardInPlay` заменить на:
```ts
export interface CardInPlay {
  cardId: string;
  queue: CardSymbol[];
  /** Кому карта уйдёт в руку после розыгрыша вместо сброса. */
  giveTo?: PlayerID;
  /** Перед кем карта ляжет после розыгрыша (зона front). */
  toFront?: PlayerID;
}
```

`GameOver.reason`: `'personality' | 'vimes' | 'score' | 'manual'`.

Перед `export interface AMState` добавить:
```ts
export type PromptKind = 'player' | 'area' | 'piece' | 'hand' | 'choice' | 'reveal';
export type Choice = string | number | string[];

/** Текущий вопрос свитка: кто отвечает и из чего выбирает. */
export interface Prompt {
  cardId: string;
  step: string;
  data: Record<string, any>;
  actor: PlayerID;
  kind: PromptKind;
  /** player: id игроков; area: номера районов; piece: ключи фишек; choice: ключи кнопок; reveal: id карт. */
  options: (string | number)[];
  /** Подписи кнопок для choice. */
  labels?: Record<string, string>;
  /** Для hand: сколько карт выбрать. */
  min?: number;
  max?: number;
  text: string;
  /** Скрытые карты/личности, видимые только actor. */
  reveal?: string[];
  /** Шаг открыл скрытое или случайное: пропустить и отменить нельзя. */
  locked?: boolean;
}
```

В `AMState` после `gameover: GameOver | null;` добавить:
```ts
  /** Неиспользованные личности (скрыты). */
  spare: PersonalityId[];
  prompt: Prompt | null;
  /** Последний ход свитка открыл скрытое/случайное — его нельзя отменить. */
  noUndo: boolean;
  /** Ручной просмотр неиспользованных личностей: виден только player. */
  peek: { player: PlayerID; cards: string[] } | null;
```
и после `eventsCount?: number;`:
```ts
  spareCount?: number;
```

- [ ] **Step 2: Подготовка, правила, данные**

`packages/engine/src/data/cards.ts` — в конец:
```ts
/** Карты, которые после розыгрыша лежат «перед игроком» и занимают место в руке при доборе. */
export const STUCK_CARDS = ['fools-guild', 'drwhiteface'];
```

`packages/engine/src/setup.ts`: в объект игрока добавить `front: [],`; в возвращаемый объект после `gameover: null,` добавить:
```ts
    spare: personalities.slice(numPlayers),
    prompt: null,
    noUndo: false,
    peek: null,
```

`packages/engine/src/rules.ts`: функции `onEnter`/`onLeave` переименовать и экспортировать, все вызовы обновить:
```ts
/** Вход слугоподобной фишки: беспорядок, если в районе уже кто-то есть. Вызывать ДО добавления фишки. */
export function troubleEnter(a: AreaState): void {
  if (minionLikeCount(a) > 0) a.trouble = true;
}

/** Уход слугоподобной фишки снимает беспорядок. */
export function troubleLeave(a: AreaState): void {
  a.trouble = false;
}
```

`packages/engine/src/victory.ts`: `deckOutResult` разделить:
```ts
/** Победитель по очкам (ничья — дороже район). */
export function scoreResult(G: AMState): GameOver {
  const pids = Object.keys(G.players);
  const scores = Object.fromEntries(pids.map((pid) => [pid, finalScore(G, pid)]));
  const winner = [...pids].sort(
    (a, b) => scores[b] - scores[a] || bestDistrictCost(G, b) - bestDistrictCost(G, a),
  )[0];
  return { winner, reason: 'score', personalities: allPersonalities(G), scores };
}

/** Итог, когда закончилась колода. */
export function deckOutResult(G: AMState): GameOver {
  const vimes = Object.keys(G.players).find((pid) => G.players[pid].personality === 'commander-vimes');
  if (vimes) return { winner: vimes, reason: 'vimes', personalities: allPersonalities(G) };
  return scoreResult(G);
}
```

- [ ] **Step 3: Ход — зона «перед игроком», «застрявшие» карты, prompt, peek**

`packages/engine/src/turn.ts`:

Импорт: `import { CARD_BY_ID, EVENT_BY_ID, STUCK_CARDS } from './data/cards';`

`startTurn` дополнить строкой `G.peek = null;` и `G.prompt = null;`.

`finishIfDone` заменить:
```ts
function finishIfDone(G: AMState): void {
  if (G.play && G.play.queue.length === 0) {
    const { cardId, giveTo, toFront } = G.play;
    if (toFront) G.players[toFront].front.push(cardId);
    else if (giveTo) G.players[giveTo].hand.push(cardId);
    else G.discard.push(cardId);
    G.play = null;
  }
}
```

`advance` экспортировать под именем `advanceSymbol` (обновить все вызовы внутри файла):
```ts
/** Текущий символ выполнен: перейти к следующему (карта уходит, когда символы кончились). */
export function advanceSymbol(G: AMState): void {
  G.play!.queue.shift();
  finishIfDone(G);
}
```

`skipSymbol` заменить:
```ts
export function skipSymbol(G: AMState, pid: PlayerID): string | null {
  const s = currentSymbol(G);
  if (!s) return 'Нет действия';
  if (s.kind === 'event') return 'Случайное событие нельзя пропустить';
  if (G.prompt?.locked) return 'Этот шаг уже нельзя пропустить';
  G.prompt = null;
  advanceSymbol(G);
  return null;
}
```

`canEndTurn` — первой строкой: `if (G.prompt) return 'Сначала ответьте на вопрос карты';`

`refillHand` заменить:
```ts
export function refillHand(G: AMState, pid: PlayerID): void {
  const p = G.players[pid];
  const stuck = p.front.filter((c) => STUCK_CARDS.includes(c)).length;
  const need = HAND_SIZE - p.hand.length - stuck;
  if (need > 0) drawCards(G, pid, need);
}
```

- [ ] **Step 4: playerView**

`packages/engine/src/view.ts` — `playerView` заменить:
```ts
export function playerView({ G, playerID }: { G: AMState; playerID?: PlayerID | null }): AMState {
  if (G.gameover) return G;
  const players = Object.fromEntries(
    Object.entries(G.players).map(([pid, p]) => [
      pid,
      pid === playerID ? p : { ...p, hand: p.hand.map(() => HIDDEN_CARD), personality: null },
    ]),
  );
  // Скрытое в вопросе видит только тот, кто отвечает.
  const prompt = G.prompt && G.prompt.actor !== playerID && (G.prompt.reveal || G.prompt.kind === 'reveal')
    ? { ...G.prompt, reveal: undefined, options: [] }
    : G.prompt;
  return {
    ...G, players, prompt,
    deck: [], events: [], spare: [],
    peek: G.peek?.player === playerID ? G.peek : null,
    deckCount: G.deck.length, eventsCount: G.events.length, spareCount: G.spare.length,
  };
}
```

- [ ] **Step 5: Написать падающие тесты ручных действий**

В конец `describe` в `packages/engine/src/manual.test.ts` (перед последней `});`) добавить:
```ts
  it('перемещение фишек между районами (без автоматики)', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'movePiece', from: 1, to: 9, piece: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
    expect(G.areas[9].minions['1']).toBe(1);
    expect(G.areas[1].trouble).toBe(true);
    expect(applyManual(G, '0', { type: 'movePiece', from: 1, to: 9, piece: 'trouble' })).toBeNull();
    expect([G.areas[1].trouble, G.areas[9].trouble]).toEqual([false, true]);
    expect(applyManual(G, '0', { type: 'movePiece', from: 2, to: 3, piece: 'demon' })).not.toBeNull();
    G.areas[4].building = '2';
    expect(applyManual(G, '0', { type: 'movePiece', from: 4, to: 6, piece: 'building' })).toBeNull();
    expect([G.areas[4].building, G.areas[6].building]).toEqual([null, '2']);
  });

  it('карта из руки — в колоду и перед игроком; из зоны «перед» — обратно', () => {
    const G = fresh();
    const [a, b, c] = G.players['0'].hand;
    expect(applyManual(G, '0', { type: 'returnToDeck', cardId: a, where: 'top' })).toBeNull();
    expect(G.deck[0]).toBe(a);
    expect(applyManual(G, '0', { type: 'returnToDeck', cardId: b, where: 'bottom' })).toBeNull();
    expect(G.deck.at(-1)).toBe(b);
    expect(applyManual(G, '0', { type: 'toFront', cardId: c, player: '2' })).toBeNull();
    expect(G.players['2'].front).toEqual([c]);
    expect(applyManual(G, '0', { type: 'fromFront', player: '2', cardId: c, to: 'hand' })).toBeNull();
    expect(G.players['0'].hand).toContain(c);
  });

  it('вернуть разыгрываемую карту, +1 карта, убрать событие', () => {
    const G = fresh();
    startTurn(G);
    const card = G.players['0'].hand[0];
    playCard(G, '0', card);
    if (G.play) {
      expect(applyManual(G, '0', { type: 'returnPlayed' })).toBeNull();
      expect(G.play).toBeNull();
      expect(G.players['0'].hand).toContain(card);
      expect(G.playsLeft).toBe(1);
    }
    expect(applyManual(G, '0', { type: 'extraPlay' })).toBeNull();
    expect(G.playsLeft).toBe(2);
    G.lastEvent = 'fog';
    expect(applyManual(G, '0', { type: 'dropEvent' })).toBeNull();
    expect(G.lastEvent).toBeNull();
  });

  it('объявить конец игры: победитель или подсчёт', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'declareEnd', winner: '2' })).toBeNull();
    expect(G.gameover).toMatchObject({ winner: '2', reason: 'manual' });
    const H = fresh();
    applyManual(H, '0', { type: 'declareEnd', winner: null });
    expect(H.gameover?.reason).toBe('score');
  });

  it('случайная карта у игрока, событие обратно, личность, просмотр', () => {
    const G = fresh();
    const theirs = [...G.players['1'].hand];
    expect(takeRandomCard(G, '0', '1', (x) => [...x])).toBeNull();
    expect(G.players['0'].hand).toContain(theirs[0]);
    expect(G.players['1'].hand).toHaveLength(4);
    G.lastEvent = 'fog';
    expect(eventBack(G, '0', 'top', (x) => [...x])).toBeNull();
    expect(G.events[0]).toBe('fog');
    const before = G.players['0'].personality;
    expect(swapPersonality(G, '0', (x) => [...x])).toBeNull();
    expect(G.players['0'].personality).not.toBe(before);
    expect(G.spare).toContain(before);
    expect(peekSpare(G, '0')).toBeNull();
    expect(G.peek).toEqual({ player: '0', cards: G.spare });
  });

  it('Гильдия шутов «перед игроком» занимает место в руке при доборе', () => {
    const G = fresh();
    G.players['1'].hand = [];
    G.players['1'].front = ['fools-guild'];
    refillHand(G, '1');
    expect(G.players['1'].hand).toHaveLength(4);
  });
```
Импорты в начале файла дополнить:
```ts
import { applyManual, eventBack, peekSpare, swapPersonality, takeRandomCard } from './manual';
import { playCard, refillHand, skipSymbol, startTurn } from './turn';
```
(строку `import { applyManual } from './manual';` и прежний импорт из `./turn` заменить этими).

- [ ] **Step 6: Тесты падают**

```bash
npm test
```
Expected: FAIL (нет `takeRandomCard` и новых типов действий).

- [ ] **Step 7: Реализация ручных действий**

`packages/engine/src/manual.ts`:

Импорты:
```ts
import type { AMState, AreaId, PersonalityId, PlayerID } from './types';
import { MAX_DEMONS, MAX_TROLLS } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { CARD_BY_ID, EVENT_BY_ID } from './data/cards';
import { log, nameOf } from './helpers';
import { scoreResult, allPersonalities } from './victory';
```

В `ManualAction` добавить варианты:
```ts
  | { type: 'movePiece'; from: AreaId; to: AreaId; piece: 'minion' | 'building' | 'demon' | 'troll' | 'trouble'; owner?: PlayerID }
  | { type: 'returnToDeck'; cardId: string; where: 'top' | 'bottom' }
  | { type: 'toFront'; cardId: string; player: PlayerID }
  | { type: 'fromFront'; player: PlayerID; cardId: string; to: 'discard' | 'hand' }
  | { type: 'returnPlayed' }
  | { type: 'dropEvent' }
  | { type: 'extraPlay' }
  | { type: 'declareEnd'; winner: PlayerID | null }
```

В `switch` перед `case 'givePlayed'` добавить:
```ts
    case 'movePiece': {
      const from = G.areas[a.from];
      const to = G.areas[a.to];
      if (!from || !to || a.from === a.to) return 'Неверные районы';
      const where = `${areaDef(a.from).name} → ${areaDef(a.to).name}`;
      if (a.piece === 'minion') {
        if (!a.owner || !(from.minions[a.owner] > 0)) return 'Там нет такого слуги';
        from.minions[a.owner]--;
        to.minions[a.owner]++;
        log(G, `${who}: слуга ${nameOf(G, a.owner)} ${where}`);
      } else if (a.piece === 'building') {
        if (!from.building || to.building) return 'Здание не переносится';
        to.building = from.building;
        from.building = null;
        log(G, `${who}: здание ${nameOf(G, to.building)} ${where}`);
      } else if (a.piece === 'trouble') {
        if (!from.trouble) return 'Там нет беспорядка';
        from.trouble = false;
        to.trouble = true;
        log(G, `${who}: беспорядок ${where}`);
      } else {
        const key = a.piece === 'demon' ? 'demons' : 'trolls';
        if (from[key] < 1) return 'Там их нет';
        from[key]--;
        to[key]++;
        log(G, `${who}: ${a.piece === 'demon' ? 'демон' : 'тролль'} ${where}`);
      }
      return null;
    }
    case 'returnToDeck': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      hand.splice(i, 1);
      if (a.where === 'top') G.deck.unshift(a.cardId);
      else G.deck.push(a.cardId);
      log(G, `${who}: кладёт карту ${a.where === 'top' ? 'наверх' : 'под низ'} колоды`);
      return null;
    }
    case 'toFront': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0 || !G.players[a.player]) return 'Нельзя';
      hand.splice(i, 1);
      G.players[a.player].front.push(a.cardId);
      log(G, `${who}: кладёт «${CARD_BY_ID[a.cardId]?.name}» перед игроком ${nameOf(G, a.player)}`);
      return null;
    }
    case 'fromFront': {
      const front = G.players[a.player]?.front;
      const i = front ? front.indexOf(a.cardId) : -1;
      if (i < 0) return 'Такой карты там нет';
      front!.splice(i, 1);
      if (a.to === 'hand') G.players[pid].hand.push(a.cardId);
      else G.discard.push(a.cardId);
      log(G, `${who}: «${CARD_BY_ID[a.cardId]?.name}» из-перед ${nameOf(G, a.player)} — ${a.to === 'hand' ? 'себе в руку' : 'в сброс'}`);
      return null;
    }
    case 'returnPlayed': {
      if (!G.play) return 'Сейчас нет разыгрываемой карты';
      G.players[pid].hand.push(G.play.cardId);
      log(G, `${who}: возвращает «${CARD_BY_ID[G.play.cardId]?.name}» в руку`);
      G.play = null;
      G.prompt = null;
      G.playsLeft++;
      G.cardsPlayed = Math.max(0, G.cardsPlayed - 1);
      return null;
    }
    case 'dropEvent': {
      if (!G.lastEvent) return 'Нет вытянутого события';
      log(G, `${who}: событие «${EVENT_BY_ID[G.lastEvent]?.name}» убрано из игры`);
      G.lastEvent = null;
      return null;
    }
    case 'extraPlay': {
      G.playsLeft++;
      log(G, `${who}: можно сыграть ещё одну карту`);
      return null;
    }
    case 'declareEnd': {
      G.gameover = a.winner === null
        ? scoreResult(G)
        : { winner: a.winner, reason: 'manual', personalities: allPersonalities(G) };
      log(G, `${who}: игра окончена ${a.winner === null ? '(подсчёт очков)' : `— победитель ${nameOf(G, a.winner)}`}`);
      return null;
    }
```

В конец файла:
```ts
type Shuffle = <T>(arr: T[]) => T[];

/** Взять случайную карту из руки другого игрока себе. */
export function takeRandomCard(G: AMState, pid: PlayerID, from: PlayerID, shuffle: Shuffle): string | null {
  const hand = G.players[from]?.hand;
  if (!hand?.length || from === pid) return 'Не у кого брать';
  const card = shuffle(hand)[0];
  hand.splice(hand.indexOf(card), 1);
  G.players[pid].hand.push(card);
  log(G, `✋ ${nameOf(G, pid)}: берёт случайную карту у ${nameOf(G, from)}`);
  return null;
}

/** Вернуть вытянутое событие в колоду событий: наверх или замешав. */
export function eventBack(G: AMState, pid: PlayerID, where: 'top' | 'shuffle', shuffle: Shuffle): string | null {
  if (!G.lastEvent) return 'Нет вытянутого события';
  const ev = G.lastEvent;
  G.lastEvent = null;
  G.events = where === 'top' ? [ev, ...G.events] : shuffle([...G.events, ev]);
  log(G, `✋ ${nameOf(G, pid)}: событие «${EVENT_BY_ID[ev]?.name}» возвращено в колоду${where === 'top' ? ' наверх' : ''}`);
  return null;
}

/** Заменить свою личность случайной неиспользованной (Зорго). */
export function swapPersonality(G: AMState, pid: PlayerID, shuffle: Shuffle): string | null {
  if (!G.spare.length) return 'Неиспользованных личностей нет';
  const pick = shuffle(G.spare)[0] as PersonalityId;
  const mine = G.players[pid].personality!;
  G.spare = G.spare.map((s) => (s === pick ? mine : s));
  G.players[pid].personality = pick;
  log(G, `✋ ${nameOf(G, pid)}: меняет свою личность на случайную`);
  return null;
}

/** Показать себе неиспользованные личности (Миссис Кейк). */
export function peekSpare(G: AMState, pid: PlayerID): string | null {
  G.peek = { player: pid, cards: [...G.spare] };
  log(G, `✋ ${nameOf(G, pid)}: смотрит неиспользованные личности`);
  return null;
}
```

- [ ] **Step 8: Ходы и проверка «ходит текущий игрок»**

`packages/engine/src/game.ts`:

Импорты дополнить:
```ts
import { ActivePlayers, INVALID_MOVE } from 'boardgame.io/core';
import { applyManual, eventBack, peekSpare, swapPersonality, takeRandomCard, type ManualAction } from './manual';
```

После `const check = …` добавить:
```ts
/** В фазе play активны все (чтобы соперник мог отвечать); ходить может только текущий игрок. */
const turnOnly = <A extends unknown[]>(fn: (c: any, ...args: A) => unknown) =>
  (c: any, ...args: A) => (c.playerID === c.ctx.currentPlayer ? fn(c, ...args) : INVALID_MOVE);
```

В `play.turn` добавить `activePlayers: ActivePlayers.ALL,`.

Каждый ход фазы `play` обернуть в `turnOnly(...)`: для коротких — `playCard: turnOnly(({ G, playerID }, cardId: string) => …)`; для длинных — `move: turnOnly(({ G, playerID }) => …)`.

В `moves` фазы `play` добавить:
```ts
        manualTakeRandom: {
          move: turnOnly(({ G, playerID, random }, from: string) => check(takeRandomCard(G, playerID, from, random.Shuffle))),
          client: false, undoable: false,
        },
        manualEventBack: {
          move: turnOnly(({ G, playerID, random }, where: 'top' | 'shuffle') => check(eventBack(G, playerID, where, random.Shuffle))),
          client: false, undoable: false,
        },
        manualSwapPersonality: {
          move: turnOnly(({ G, playerID, random }) => check(swapPersonality(G, playerID, random.Shuffle))),
          client: false, undoable: false,
        },
        manualPeekSpare: {
          move: turnOnly(({ G, playerID }) => check(peekSpare(G, playerID))),
          client: false, undoable: false,
        },
        manualRoll: {
          move: turnOnly(({ G, playerID, random }) => { log(G, `✋ ${nameOf(G, playerID)}: на кубике ${random.D12()}`); }),
          client: false, undoable: false,
        },
        manualEndTurn: {
          move: turnOnly(({ G, playerID, events }) => {
            if (G.play) { G.discard.push(G.play.cardId); G.play = null; }
            G.prompt = null;
            log(G, `✋ ${nameOf(G, playerID)}: заканчивает ход без добора`);
            events.endTurn();
          }),
          client: false, undoable: false,
        },
```

- [ ] **Step 9: Тест «ходит только текущий» в `game.test.ts`**

В `describe('лобби', …)` после первого теста добавить новый `describe`:
```ts
describe('чужой ход', () => {
  it('не текущий игрок не может играть карты', () => {
    const client = started(2);
    const { G, ctx } = client.getState()!;
    const other = ctx.currentPlayer === '0' ? '1' : '0';
    client.updatePlayerID(other);
    client.moves.playCard(G.players[other].hand[0]);
    expect(client.getState()!.G.play).toBeNull();
  });
});
```

- [ ] **Step 10: Тесты и сборка**

```bash
npm test
npm run build -w packages/engine
```
Expected: всё PASS, сборка без ошибок (сломанные из-за переименований импорты — починить).

- [ ] **Step 11: Commit**

```bash
git add packages/engine/src
git commit -m "Ручной режим: перемещение фишек, карты между зонами, события, личности, конец игры

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Ручной режим — интерфейс

**Files:**
- Modify: `packages/client/src/table/ManualPanel.tsx` (полная замена), `packages/client/src/table/PlayersPanel.tsx`, `packages/client/src/table/Table.tsx`, `packages/client/src/table/GameOverPanel.tsx`, `packages/client/src/styles.css`

**Interfaces:**
- Consumes: новые `ManualAction` и ходы Task 1.
- Produces: `ManualPanel`, `ManualAreaMenu` (с перемещением), `PeekModal` (в `ManualPanel.tsx`).

- [ ] **Step 1: ManualPanel — полная замена**

`packages/client/src/table/ManualPanel.tsx`:
```tsx
import { useState } from 'react';
import {
  AREA_IDS, CARD_BY_ID, EVENT_BY_ID, HIDDEN_CARD, PERSONALITY_BY_ID, areaDef,
  type AMState, type AreaId, type ManualAction, type PersonalityId,
} from '@am/engine';
import { personalityImg } from './assets';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="manual-sec" open><summary>{title}</summary>{children}</details>;
}

export function ManualPanel({ G, me, moves, nameOf, on, setOn }: {
  G: AMState; me: string; moves: any; nameOf: (pid: string) => string; on: boolean; setOn: (v: boolean) => void;
}) {
  const pids = Object.keys(G.players);
  const others = pids.filter((p) => p !== me);
  const [from, setFrom] = useState<string>('bank');
  const [to, setTo] = useState<string>(me);
  const [amount, setAmount] = useState(1);
  const [card, setCard] = useState('');
  const [target, setTarget] = useState(others[0] ?? me);
  const [fromDiscard, setFromDiscard] = useState('');
  const [winner, setWinner] = useState('score');
  const hand = G.players[me].hand.filter((c) => c !== HIDDEN_CARD);
  const act = (a: ManualAction) => moves.manual(a);
  const who = (p: string) => (p === 'bank' ? 'Банк' : nameOf(p));
  const name = (c: string) => CARD_BY_ID[c]?.name ?? c;
  const playerSelect = (value: string, set: (v: string) => void, list = others) => (
    <select value={value} onChange={(e) => set(e.target.value)}>
      {list.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
    </select>
  );
  const withCard = (fn: () => void) => () => { if (card) { fn(); setCard(''); } };

  return (
    <div className={`manual ${on ? 'on' : ''}`}>
      <button className="btn" onClick={() => setOn(!on)}>✋ {on ? 'Выйти из ручного режима' : 'Ручной режим'}</button>
      {on && (
        <div className="manual-body">
          <div className="manual-hint">Клик по району — фишки, перемещение, беспорядки. Всё пишется в лог.</div>

          <Section title="Деньги">
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
              Займы: {G.players[me].loans}
              <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: 1 })}>+</button>
              <button className="btn small" onClick={() => act({ type: 'loan', player: me, delta: -1 })}>−</button>
            </div>
          </Section>

          <Section title="Карты">
            <div className="manual-row">
              <select value={card} onChange={(e) => setCard(e.target.value)}>
                <option value="">— карта из руки —</option>
                {hand.map((c, i) => <option key={`${c}-${i}`} value={c}>{name(c)}</option>)}
              </select>
              {playerSelect(target, setTarget)}
            </div>
            <div className="manual-row">
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'discard', cardId: card }))}>В сброс</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'give', cardId: card, to: target }))}>Отдать игроку</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'toFront', cardId: card, player: target }))}>Перед игроком</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'toFront', cardId: card, player: me }))}>Перед собой</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'returnToDeck', cardId: card, where: 'top' }))}>Наверх колоды</button>
              <button className="btn small" disabled={!card} onClick={withCard(() => act({ type: 'returnToDeck', cardId: card, where: 'bottom' }))}>Под низ колоды</button>
            </div>
            <div className="manual-row">
              <button className="btn small" onClick={() => moves.manualDraw()}>Взять из колоды</button>
              <button className="btn small" onClick={() => moves.manualTakeRandom(target)}>Случайную у игрока</button>
            </div>
            <div className="manual-row">
              <select value={fromDiscard} onChange={(e) => setFromDiscard(e.target.value)}>
                <option value="">— карта из сброса —</option>
                {[...new Set(G.discard)].reverse().map((c) => <option key={c} value={c}>{name(c)}</option>)}
              </select>
              <button className="btn small" disabled={!fromDiscard} onClick={() => { act({ type: 'takeDiscard', cardId: fromDiscard }); setFromDiscard(''); }}>Взять из сброса</button>
            </div>
            {pids.flatMap((p) => G.players[p].front.map((c) => (
              <div key={`${p}-${c}`} className="manual-row">
                «{name(c)}» перед {nameOf(p)}:
                <button className="btn small" onClick={() => act({ type: 'fromFront', player: p, cardId: c, to: 'discard' })}>в сброс</button>
                <button className="btn small" onClick={() => act({ type: 'fromFront', player: p, cardId: c, to: 'hand' })}>себе в руку</button>
              </div>
            )))}
            {G.play && (
              <div className="manual-row">
                Разыгрывается «{name(G.play.cardId)}»:
                <button className="btn small" onClick={() => act({ type: 'returnPlayed' })}>Вернуть в руку</button>
                <button className="btn small" onClick={() => act({ type: 'givePlayed', to: target })}>
                  {G.play.giveTo ? `уйдёт: ${nameOf(G.play.giveTo)}` : 'После розыгрыша — игроку'}
                </button>
              </div>
            )}
          </Section>

          <Section title="События и личности">
            {G.lastEvent && (
              <div className="manual-row">
                «{EVENT_BY_ID[G.lastEvent]?.name}»:
                <button className="btn small" onClick={() => moves.manualEventBack('top')}>Наверх колоды</button>
                <button className="btn small" onClick={() => moves.manualEventBack('shuffle')}>Замешать</button>
                <button className="btn small" onClick={() => act({ type: 'dropEvent' })}>Убрать</button>
              </div>
            )}
            <div className="manual-row">
              <button className="btn small" onClick={() => moves.manualSwapPersonality()}>Сменить личность на случайную</button>
              <button className="btn small" onClick={() => moves.manualPeekSpare()}>Посмотреть неиспользованные</button>
            </div>
          </Section>

          <Section title="Ход и игра">
            <div className="manual-row">
              <button className="btn small" onClick={() => act({ type: 'extraPlay' })}>+1 карта</button>
              <button className="btn small" onClick={() => moves.manualRoll()}>🎲 Бросить кубик</button>
              <button className="btn small" onClick={() => moves.manualEndTurn()}>Закончить ход без добора</button>
            </div>
            <div className="manual-row">
              <select value={winner} onChange={(e) => setWinner(e.target.value)}>
                <option value="score">Подсчёт очков</option>
                {pids.map((p) => <option key={p} value={p}>Победитель: {nameOf(p)}</option>)}
              </select>
              <button className="btn small" onClick={() => { if (confirm('Закончить игру?')) act({ type: 'declareEnd', winner: winner === 'score' ? null : winner }); }}>Закончить игру</button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

const PIECES = [
  { piece: 'demon', label: 'Демон', key: 'demons' },
  { piece: 'troll', label: 'Тролль', key: 'trolls' },
] as const;

export function ManualAreaMenu({ G, area, moves, nameOf, onClose }: {
  G: AMState; area: AreaId; moves: any; nameOf: (pid: string) => string; onClose: () => void;
}) {
  const a = G.areas[area];
  const act = (x: ManualAction) => moves.manual(x);
  const [dest, setDest] = useState<AreaId>(AREA_IDS.find((id) => id !== area)!);
  const move = (piece: 'minion' | 'building' | 'demon' | 'troll' | 'trouble', owner?: string) =>
    act({ type: 'movePiece', from: area, to: dest, piece, owner });
  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>✋ {areaDef(area).name}</h3>
        <div className="manual-row">
          Переместить в:
          <select value={dest} onChange={(e) => setDest(Number(e.target.value))}>
            {AREA_IDS.filter((id) => id !== area).map((id) => <option key={id} value={id}>{areaDef(id).name}</option>)}
          </select>
        </div>
        {Object.keys(G.players).map((pid) => (
          <div key={pid} className="manual-row">
            <span className="grow">Слуги {nameOf(pid)}: {a.minions[pid]}</span>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: 'minion', area, owner: pid, delta: -1 })}>−</button>
            <button className="btn small" disabled={!a.minions[pid]} onClick={() => move('minion', pid)}>→</button>
          </div>
        ))}
        <div className="manual-row">
          <span className="grow">Здание</span>
          <select value={a.building ?? ''} onChange={(e) => act({ type: 'building', area, owner: e.target.value || null })}>
            <option value="">нет</option>
            {Object.keys(G.players).map((pid) => <option key={pid} value={pid}>{nameOf(pid)}</option>)}
          </select>
          <button className="btn small" disabled={!a.building} onClick={() => move('building')}>→</button>
        </div>
        <div className="manual-row">
          <span className="grow">Беспорядок: {a.trouble ? 'есть' : 'нет'}</span>
          <button className="btn small" onClick={() => act({ type: 'trouble', area, on: !a.trouble })}>{a.trouble ? 'Убрать' : 'Положить'}</button>
          <button className="btn small" disabled={!a.trouble} onClick={() => move('trouble')}>→</button>
        </div>
        {PIECES.map(({ piece, label, key }) => (
          <div key={piece} className="manual-row">
            <span className="grow">{label}: {a[key]}</span>
            <button className="btn small" onClick={() => act({ type: piece, area, delta: 1 })}>+</button>
            <button className="btn small" onClick={() => act({ type: piece, area, delta: -1 })}>−</button>
            <button className="btn small" disabled={!a[key]} onClick={() => move(piece)}>→</button>
          </div>
        ))}
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

/** Неиспользованные личности, которые игрок посмотрел вручную (видны только ему). */
export function PeekModal({ G, me }: { G: AMState; me: string | null }) {
  const [closed, setClosed] = useState('');
  const key = G.peek ? G.peek.cards.join(',') + G.log.length : '';
  if (!G.peek || G.peek.player !== me || closed === key) return null;
  return (
    <div className="popup" onClick={() => setClosed(key)}>
      <div className="popup-box reveal-box">
        <h3>Неиспользованные личности</h3>
        <div className="reveal">
          {G.peek.cards.map((c) => (
            <figure key={c}><img src={personalityImg(c as PersonalityId)} alt={PERSONALITY_BY_ID[c as PersonalityId]?.name} /></figure>
          ))}
        </div>
        <button className="btn" onClick={() => setClosed(key)}>Закрыть</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Зона «перед игроком» в панели игроков**

`packages/client/src/table/PlayersPanel.tsx`: импорт `CARD_BY_ID` из `@am/engine` и `cardImg` из `./assets`; после блока `player-districts` добавить:
```tsx
            {p.front.length > 0 && (
              <div className="player-front">
                {p.front.map((c) => <img key={c} src={cardImg(c)} alt={CARD_BY_ID[c]?.name} title={CARD_BY_ID[c]?.name} />)}
              </div>
            )}
```

- [ ] **Step 3: Table и GameOverPanel**

`packages/client/src/table/Table.tsx`: импорт `PeekModal` из `./ManualPanel`; перед `{G.gameover && …}` добавить `<PeekModal G={G} me={me} />`.

`packages/client/src/table/GameOverPanel.tsx`: в `REASON` добавить `manual: 'объявлено вручную',`.

- [ ] **Step 4: Стили**

В конец `packages/client/src/styles.css`:
```css
.manual-sec { border-top: 1px solid #6b442333; padding-top: 4px; }
.manual-sec summary { cursor: pointer; font-weight: 700; font-size: 0.8rem; margin-bottom: 4px; }
.table-side { overflow-y: auto; }
.player-front { display: flex; gap: 3px; margin-top: 3px; }
.player-front img { height: 46px; border-radius: 3px; transition: transform 0.15s; transform-origin: top left; }
.player-front img:hover { transform: scale(3.5); position: relative; z-index: 20; }
.reveal-box { max-width: 900px; }
```

- [ ] **Step 5: Сборка и проверка в хотсите**

```bash
npm run build
```
Перезапустить сервер (`npm run play`). В хотсите: ручной режим → переместить слугу через меню района, положить карту перед игроком (видна в панели), вернуть событие, посмотреть неиспользованные личности (окно видно только себе), «Закончить игру» → экран итога.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src
git commit -m "Ручной режим в интерфейсе: зоны карт, перемещение фишек, события, личности, конец игры

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Исполнитель свитков (prompt, answer, отмена)

**Files:**
- Create: `packages/engine/src/cards/run.ts`, `packages/engine/src/cards/ops.ts`, `packages/engine/src/cards/index.ts`, `packages/engine/src/cards/testkit.ts`, `packages/engine/src/cards/run.test.ts`
- Modify: `packages/engine/src/game.ts`, `packages/engine/src/index.ts`

**Interfaces:**
- Produces:
  - `run.ts`: `interface Rnd { d12(): number; shuffle<T>(a: T[]): T[] }`, `interface EffectApi { G; pid; rnd; others: PlayerID[]; locked: boolean; lock(): void }`, `type PromptSpec`, `type Next = PromptSpec | null`, `interface Effect { start(api): Next | string; answer?(api, p: Prompt, c: Choice): Next | string }`, `defineEffects(map)`, `effectFor(cardId)`, `hasEffect(cardId)`, `makeApi(G, pid, order, rnd)`, `startScroll(api)`, `answerPrompt(api, choice)`.
  - `ops.ts`: `PieceKind`, `PieceRef`, `pieceKey`, `parsePiece`, `pieces(G, filter)`, `pieceName(G, ref)`, `removePiece`, `moveMinion`, `putMinion`, `pay`, `moveCards`, `cardNames`, `say`, `ask(api, spec)`.
  - Ходы `startScroll()` и `answer(choice)` в фазе `play` (`client: false`, `undoable: ({ G }) => !G.noUndo`).
  - `testkit.ts`: `scenario(cardId, opts)` → `{ G, start(), answer(pid, choice), prompt() }`.

- [ ] **Step 1: run.ts**

`packages/engine/src/cards/run.ts`:
```ts
import type { AMState, Choice, PlayerID, Prompt } from '../types';
import { advanceSymbol, currentSymbol } from '../turn';

export interface Rnd {
  d12(): number;
  shuffle<T>(arr: T[]): T[];
}

export interface EffectApi {
  G: AMState;
  pid: PlayerID;
  rnd: Rnd;
  /** Остальные игроки в порядке хода, начиная со следующего. */
  others: PlayerID[];
  /** Ход открыл скрытое или случайное: его нельзя отменить. */
  locked: boolean;
  lock(): void;
}

export type PromptSpec = Omit<Prompt, 'cardId' | 'data'> & { data?: Record<string, any> };
export type Next = PromptSpec | null;

/** Сценарий свитка: start — первый вопрос (или null — уже выполнено); answer — следующий. */
export interface Effect {
  start(api: EffectApi): Next | string;
  answer?(api: EffectApi, p: Prompt, choice: Choice): Next | string;
}

const REGISTRY: Record<string, Effect> = {};

export function defineEffects(map: Record<string, Effect>): void {
  Object.assign(REGISTRY, map);
}
export const effectFor = (cardId: string): Effect | undefined => REGISTRY[cardId];
export const hasEffect = (cardId: string): boolean => !!REGISTRY[cardId];

export function makeApi(G: AMState, pid: PlayerID, order: PlayerID[], rnd: Rnd): EffectApi {
  const i = order.indexOf(pid);
  const api: EffectApi = {
    G, pid, rnd,
    others: [...order.slice(i + 1), ...order.slice(0, i)],
    locked: false,
    lock() { api.locked = true; },
  };
  return api;
}

function settle(api: EffectApi, next: Next | string): string | null {
  if (typeof next === 'string') return next;
  const { G } = api;
  if (next) {
    G.prompt = { ...next, data: next.data ?? {}, cardId: G.play!.cardId };
    if (next.locked) api.lock();
  } else {
    G.prompt = null;
    advanceSymbol(G);
  }
  return null;
}

export function startScroll(api: EffectApi): string | null {
  const { G, pid } = api;
  if (!G.play || currentSymbol(G)?.kind !== 'scroll') return 'Сейчас не текст карты';
  if (G.prompt) return 'Текст карты уже разыгрывается';
  const eff = effectFor(G.play.cardId);
  if (!eff) return 'Эта карта разыгрывается вручную';
  return settle(api, eff.start(api));
}

function validate(G: AMState, p: Prompt, c: Choice): string | null {
  if (p.kind === 'hand') {
    if (!Array.isArray(c)) return 'Нужен список карт';
    const hand = G.players[p.actor].hand;
    if (new Set(c).size !== c.length || c.some((x) => !hand.includes(x))) return 'Таких карт нет в руке';
    if (c.length < (p.min ?? 0) || c.length > (p.max ?? hand.length)) return 'Не то количество карт';
    return null;
  }
  return p.options.includes(c as string | number) ? null : 'Такой вариант недоступен';
}

export function answerPrompt(api: EffectApi, choice: Choice): string | null {
  const p = api.G.prompt;
  if (!p) return 'Нет вопроса';
  if (p.actor !== api.pid) return 'Сейчас отвечает другой игрок';
  const err = validate(api.G, p, choice);
  if (err) return err;
  const eff = effectFor(p.cardId);
  if (!eff?.answer) return 'Эффект не ждёт ответа';
  return settle(api, eff.answer(api, p, choice));
}
```

- [ ] **Step 2: ops.ts**

`packages/engine/src/cards/ops.ts`:
```ts
import type { AMState, AreaId, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { CARD_BY_ID } from '../data/cards';
import { log, nameOf } from '../helpers';
import { removeTarget, troubleEnter, troubleLeave } from '../rules';
import type { EffectApi, Next, PromptSpec } from './run';

export type PieceKind = 'minion' | 'demon' | 'troll' | 'building';
export interface PieceRef { area: AreaId; kind: PieceKind; owner?: PlayerID }

export const pieceKey = (p: PieceRef): string => `${p.area}:${p.kind}:${p.owner ?? ''}`;
export function parsePiece(key: string): PieceRef {
  const [a, kind, owner] = key.split(':');
  return { area: Number(a), kind: kind as PieceKind, owner: owner || undefined };
}

/** Фишки на поле, подходящие под фильтр, — ключами pieceKey. */
export function pieces(G: AMState, filter: (p: PieceRef) => boolean): string[] {
  const out: PieceRef[] = [];
  for (const id of AREA_IDS) {
    const a = G.areas[id];
    for (const [owner, n] of Object.entries(a.minions)) if (n > 0) out.push({ area: id, kind: 'minion', owner });
    if (a.demons > 0) out.push({ area: id, kind: 'demon' });
    if (a.trolls > 0) out.push({ area: id, kind: 'troll' });
    if (a.building) out.push({ area: id, kind: 'building', owner: a.building });
  }
  return out.filter(filter).map(pieceKey);
}

export const isMinionLike = (p: PieceRef) => p.kind !== 'building';

export function pieceName(G: AMState, p: PieceRef): string {
  const where = areaDef(p.area).name;
  if (p.kind === 'minion') return `слуга ${nameOf(G, p.owner!)} (${where})`;
  if (p.kind === 'building') return `здание ${nameOf(G, p.owner!)} (${where})`;
  return `${p.kind === 'demon' ? 'демон' : 'тролль'} (${where})`;
}

export function removePiece(G: AMState, p: PieceRef): void {
  if (p.kind === 'building') {
    G.players[p.owner!].buildingSupply++;
    G.areas[p.area].building = null;
    return;
  }
  removeTarget(G, p.area, p.kind === 'minion' ? { kind: 'minion', owner: p.owner! } : { kind: p.kind });
}

/** Перемещение слуги по правилам беспорядков (уход снимает, вход в занятый район кладёт). */
export function moveMinion(G: AMState, owner: PlayerID, from: AreaId, to: AreaId): void {
  const a = G.areas[from];
  a.minions[owner]--;
  troubleLeave(a);
  const b = G.areas[to];
  troubleEnter(b);
  b.minions[owner]++;
}

/** Слуга из запаса в район; trouble=false — без жетона беспорядка. */
export function putMinion(G: AMState, owner: PlayerID, area: AreaId, trouble = true): boolean {
  const p = G.players[owner];
  if (p.minionSupply < 1) return false;
  p.minionSupply--;
  const a = G.areas[area];
  if (trouble) troubleEnter(a);
  a.minions[owner]++;
  return true;
}

/** Перевод денег «если есть»: переводится не больше, чем у отправителя. Возвращает сумму. */
export function pay(G: AMState, from: PlayerID | 'bank', to: PlayerID | 'bank', amount: number): number {
  const n = from === 'bank' ? amount : Math.min(amount, G.players[from].money);
  if (from !== 'bank') G.players[from].money -= n;
  if (to !== 'bank') G.players[to].money += n;
  return n;
}

export function moveCards(G: AMState, from: PlayerID, to: PlayerID | 'discard', cards: string[]): void {
  const hand = G.players[from].hand;
  for (const c of cards) {
    hand.splice(hand.indexOf(c), 1);
    if (to === 'discard') G.discard.push(c);
    else G.players[to].hand.push(c);
  }
}

export const cardNames = (cards: string[]) => cards.map((c) => `«${CARD_BY_ID[c]?.name ?? c}»`).join(', ');

/** Строка лога от имени игрока, разыгрывающего карту. */
export function say(api: EffectApi, text: string): void {
  const card = api.G.play ? CARD_BY_ID[api.G.play.cardId]?.name : '';
  log(api.G, `${card ? `«${card}» — ` : ''}${nameOf(api.G, api.pid)}: ${text}`);
}

/** Вопрос или null, если выбирать не из чего (часть эффекта пропускается). */
export function ask(api: EffectApi, spec: Omit<PromptSpec, 'actor'> & { actor?: PlayerID }): Next {
  const full = { actor: api.pid, ...spec } as PromptSpec;
  if (full.kind === 'hand') {
    const n = api.G.players[full.actor].hand.length;
    if (n === 0 || (full.max ?? n) === 0) {
      log(api.G, `У ${nameOf(api.G, full.actor)} нет карт — часть эффекта пропущена`);
      return null;
    }
    return { ...full, options: [], min: Math.min(full.min ?? 0, n), max: Math.min(full.max ?? n, n) };
  }
  if (full.kind !== 'reveal' && full.options.length === 0) {
    log(api.G, 'Нет подходящих вариантов — часть эффекта пропущена');
    return null;
  }
  return full;
}
```

- [ ] **Step 3: index.ts и testkit**

`packages/engine/src/cards/index.ts`:
```ts
// Регистрация эффектов всех пачек (импорт ради побочного эффекта defineEffects).
export * from './run';
export * from './ops';
```

`packages/engine/src/cards/testkit.ts`:
```ts
import type { AMState, Choice, PlayerID } from '../types';
import { setupGame } from '../setup';
import { currentSymbol, doEvent, playCard, skipSymbol, startTurn } from '../turn';
import { answerPrompt, makeApi, startScroll, type Rnd } from './run';
import './index';

/** Партия на n игроков, у '0' в руке cardId, карта сыграна и доведена до свитка. */
export function scenario(cardId: string, opts: { players?: number; rolls?: number[]; setup?: (G: AMState) => void } = {}) {
  const G = setupGame(opts.players ?? 3, (a) => [...a]);
  startTurn(G);
  G.players['0'].hand = [cardId];
  opts.setup?.(G);
  playCard(G, '0', cardId);
  while (G.play && currentSymbol(G)?.kind !== 'scroll') {
    if (currentSymbol(G)!.kind === 'event') doEvent(G, '0');
    else skipSymbol(G, '0');
  }
  const rolls = [...(opts.rolls ?? [])];
  const rnd: Rnd = { d12: () => rolls.shift() ?? 6, shuffle: (a) => [...a] };
  const order = Object.keys(G.players);
  return {
    G,
    start: () => startScroll(makeApi(G, '0', order, rnd)),
    answer: (pid: PlayerID, choice: Choice) => answerPrompt(makeApi(G, pid, order, rnd), choice),
    prompt: () => G.prompt,
  };
}
```

`packages/engine/src/index.ts` — добавить `export * from './cards';`.

- [ ] **Step 4: Ходы в game.ts**

Импорт: `import { answerPrompt, makeApi, startScroll, type Rnd } from './cards';` и `import type { Choice } from './types';`.

Помощник после `turnOnly`:
```ts
function apiFor(c: any) {
  const rnd: Rnd = { d12: () => c.random.D12(), shuffle: (a) => c.random.Shuffle(a) };
  return makeApi(c.G, c.playerID, c.ctx.playOrder, rnd);
}
```

В `moves` фазы `play`:
```ts
        startScroll: {
          move: turnOnly((c) => {
            const api = apiFor(c);
            if (startScroll(api)) return INVALID_MOVE;
            c.G.noUndo = api.locked;
          }),
          client: false,
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },
        // Отвечать может и соперник — поэтому без turnOnly; проверка actor внутри answerPrompt.
        answer: {
          move: (c: any, choice: Choice) => {
            const api = apiFor(c);
            if (answerPrompt(api, choice)) return INVALID_MOVE;
            c.G.noUndo = api.locked;
          },
          client: false,
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },
```

- [ ] **Step 5: Написать тесты исполнителя**

`packages/engine/src/cards/run.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { defineEffects, effectFor } from './run';
import { ask, say } from './ops';
import { scenario } from './testkit';
import { playerView } from '../view';

// Тестовый эффект подменяет настоящий эффект Драмнотта (только свиток) и возвращает его после теста.
const TEST = 'drumknott';
const saved = effectFor(TEST);
afterEach(() => { defineEffects({ [TEST]: saved as never }); });

describe('исполнитель свитков', () => {
  it('вопрос → ответ → карта уходит в сброс', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 's', kind: 'player', options: api.others, text: 'Кого?' }),
        answer: (api, _p, c) => { api.G.players[api.pid].money += 1; say(api, `выбран ${c}`); return null; },
      },
    });
    const s = scenario(TEST);
    expect(s.start()).toBeNull();
    expect(s.prompt()).toMatchObject({ actor: '0', kind: 'player', options: ['1', '2'] });
    expect(s.answer('1', '1')).not.toBeNull(); // отвечает не тот
    expect(s.answer('0', '9')).not.toBeNull(); // нет такого варианта
    expect(s.answer('0', '2')).toBeNull();
    expect(s.G.prompt).toBeNull();
    expect(s.G.play).toBeNull();
    expect(s.G.discard).toContain(TEST);
    expect(s.G.players['0'].money).toBe(11);
  });

  it('выбор карт из руки: количество проверяется', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 'h', kind: 'hand', options: [], min: 1, max: 2, text: 'Сбросьте', actor: '1' }),
        answer: () => null,
      },
    });
    const s = scenario(TEST);
    s.start();
    const hand = s.G.players['1'].hand;
    expect(s.answer('1', [])).not.toBeNull();
    expect(s.answer('1', hand.slice(0, 3))).not.toBeNull();
    expect(s.answer('1', ['чужая'])).not.toBeNull();
    expect(s.answer('1', hand.slice(0, 2))).toBeNull();
  });

  it('скрытое в вопросе видит только отвечающий', () => {
    defineEffects({
      [TEST]: {
        start: (api) => ask(api, { step: 'r', kind: 'reveal', options: ['a', 'b'], reveal: ['a', 'b'], text: 'Смотрите', locked: true }),
        answer: () => null,
      },
    });
    const s = scenario(TEST);
    s.start();
    expect(playerView({ G: s.G, playerID: '0' }).prompt?.reveal).toEqual(['a', 'b']);
    const other = playerView({ G: s.G, playerID: '1' }).prompt!;
    expect(other.reveal).toBeUndefined();
    expect(other.options).toEqual([]);
  });

  it('нет вариантов — часть эффекта пропущена, свиток завершён', () => {
    defineEffects({ [TEST]: { start: (api) => ask(api, { step: 'x', kind: 'area', options: [], text: '' }) } });
    const s = scenario(TEST);
    expect(s.start()).toBeNull();
    expect(s.G.play).toBeNull();
  });
});
```

- [ ] **Step 6: Тест отмены через Client (в `game.test.ts`)**

В `game.test.ts` добавить импорт `import { defineEffects, effectFor } from './cards';` и тест:
```ts
describe('свитки и отмена', () => {
  it('шаг без скрытого отменяется, шаг со скрытым — нет', () => {
    const saved = effectFor('drumknott');
    defineEffects({
      'drumknott': {
        start: (api) => ({ step: 'a', kind: 'choice', options: ['x'], labels: { x: 'X' }, text: 't', actor: api.pid }),
        answer: (api) => { api.lock(); return null; },
      },
    });
    const g: Game<AMState> = {
      ...testGame,
      setup: (args) => {
        const G = AnkhMorporkGame.setup!(args as never);
        for (const p of Object.values(G.players)) p.hand[0] = 'drumknott';
        return G;
      },
    };
    const client = started(2, g);
    client.moves.playCard('drumknott');
    client.moves.startScroll();
    expect(client.getState()!.G.prompt).not.toBeNull();
    client.undo();
    expect(client.getState()!.G.prompt).toBeNull(); // старт свитка отменён
    client.moves.startScroll();
    client.moves.answer('x');
    expect(client.getState()!.G.play).toBeNull();
    client.undo();
    expect(client.getState()!.G.play).toBeNull(); // отменить нельзя
    defineEffects({ 'drumknott': saved as never });
  });
});
```

- [ ] **Step 7: Тесты проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src
git commit -m "Исполнитель свитков: вопросы, ответы соперника, скрытое в вопросах, отмена

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Пачка 1 — без выбора (22 карты)

**Files:**
- Create: `packages/engine/src/cards/instant.ts`, `packages/engine/src/cards/instant.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './instant';`)

**Interfaces:**
- Consumes: `defineEffects`, `say`, `pay`, `drawCards`, `troubleCount`.

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/instant.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

const draws: [string, number][] = [
  ['leonard-of-quirm', 4], ['librarian', 4], ['hex', 3], ['sgt-cheery-littlebottom', 2],
  ['clack-towers', 2], ['lecturer-in-recent-runes', 2], ['moist-von-lipwig', 2],
];

describe('пачка 1: без выбора', () => {
  for (const [id, n] of draws) {
    it(`${id}: взять ${n}`, () => {
      const s = scenario(id);
      expect(s.start()).toBeNull();
      expect(s.G.players['0'].hand).toHaveLength(n);
    });
  }

  it('горгульи: по карте за своё здание', () => {
    const s = scenario('gargoyles', { setup: (G) => { G.areas[2].building = '0'; G.areas[3].building = '0'; G.areas[4].building = '1'; } });
    s.start();
    expect(s.G.players['0'].hand).toHaveLength(2);
  });

  for (const id of ['sacharissa-cripslock', 'otto-chriek', 'william-de-worde']) {
    it(`${id}: $1 за беспорядок`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.players['0'].money).toBe(13);
    });
  }

  for (const id of ['post-office', 'sir-charles-lavatory']) {
    it(`${id}: $1 за здание на поле`, () => {
      const s = scenario(id, { setup: (G) => { G.areas[2].building = '1'; G.areas[3].building = '2'; } });
      s.start();
      expect(s.G.players['0'].money).toBe(12);
    });
  }

  for (const id of ['dysk', 'opera-house']) {
    it(`${id}: $1 за слугу на Острове Богов`, () => {
      const s = scenario(id, { setup: (G) => { G.areas[10].minions['1'] = 2; G.areas[10].minions['2'] = 1; } });
      s.start();
      expect(s.G.players['0'].money).toBe(13);
    });
  }

  for (const id of ['mr-boggis', 'thieves-guild']) {
    it(`${id}: $2 с каждого, если есть`, () => {
      const s = scenario(id, { setup: (G) => { G.players['2'].money = 1; } });
      s.start();
      expect([s.G.players['0'].money, s.G.players['1'].money, s.G.players['2'].money]).toEqual([13, 8, 0]);
    });
  }

  for (const id of ['the-bank-of-ankh-morpork', 'mr-bent']) {
    it(`${id}: займ $10, карта ляжет перед игроком`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.players['0'].money).toBe(20);
      expect(s.G.players['0'].loans).toBe(1);
      expect(s.G.play?.toFront).toBe('0');
    });
  }

  for (const id of ['drumknott', 'ponder-stibbons']) {
    it(`${id}: ещё две карты`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.playsLeft).toBeGreaterThanOrEqual(2);
    });
  }

  it('исторические монахи: 4 карты из перемешанного сброса', () => {
    const s = scenario('history-monks', { setup: (G) => { G.discard = ['a', 'b', 'c', 'd', 'e', 'f']; } });
    s.start();
    expect(s.G.players['0'].hand).toEqual(['a', 'b', 'c', 'd']);
    expect(s.G.discard).toEqual(['e', 'f']);
  });
});
```

- [ ] **Step 2: Тесты падают**

```bash
npm test
```
Expected: FAIL (эффектов нет — `start()` возвращает «Эта карта разыгрывается вручную»).

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/instant.ts`:
```ts
import type { AMState } from '../types';
import { AREA_IDS } from '../data/areas';
import { drawCards } from '../helpers';
import { troubleCount } from '../rules';
import { defineEffects, type Effect } from './run';
import { pay, say } from './ops';

const draw = (n: number | ((G: AMState, pid: string) => number)): Effect => ({
  start(api) {
    api.lock();
    const want = typeof n === 'number' ? n : n(api.G, api.pid);
    say(api, `берёт карт: ${drawCards(api.G, api.pid, want)}`);
    return null;
  },
});

const gain = (count: (G: AMState) => number, what: string): Effect => ({
  start(api) {
    const n = count(api.G);
    api.G.players[api.pid].money += n;
    say(api, `+$${n} (${what})`);
    return null;
  },
});

const fromEach = (n: number): Effect => ({
  start(api) {
    for (const o of api.others) say(api, `берёт $${pay(api.G, o, api.pid, n)} у игрока ${api.G.players[o].name}`);
    return null;
  },
});

const loan: Effect = {
  start(api) {
    const p = api.G.players[api.pid];
    p.money += 10;
    p.loans++;
    api.G.play!.toFront = api.pid;
    say(api, 'берёт займ $10 (в конце вернуть $12 или −15 очков)');
    return null;
  },
};

const playTwo: Effect = {
  start(api) {
    api.G.playsLeft += 2;
    say(api, 'может сыграть ещё две карты');
    return null;
  },
};

const buildings = (G: AMState) => AREA_IDS.filter((id) => G.areas[id].building).length;
const isleMinions = (G: AMState) => Object.values(G.areas[10].minions).reduce((s, n) => s + n, 0);

defineEffects({
  'leonard-of-quirm': draw(4),
  librarian: draw(4),
  hex: draw(3),
  'sgt-cheery-littlebottom': draw(2),
  'clack-towers': draw(2),
  'lecturer-in-recent-runes': draw(2),
  'moist-von-lipwig': draw(2),
  gargoyles: draw((G, pid) => AREA_IDS.filter((id) => G.areas[id].building === pid).length),
  'sacharissa-cripslock': gain(troubleCount, 'беспорядки на поле'),
  'otto-chriek': gain(troubleCount, 'беспорядки на поле'),
  'william-de-worde': gain(troubleCount, 'беспорядки на поле'),
  'post-office': gain(buildings, 'здания на поле'),
  'sir-charles-lavatory': gain(buildings, 'здания на поле'),
  dysk: gain(isleMinions, 'слуги на Острове Богов'),
  'opera-house': gain(isleMinions, 'слуги на Острове Богов'),
  'mr-boggis': fromEach(2),
  'thieves-guild': fromEach(2),
  'the-bank-of-ankh-morpork': loan,
  'mr-bent': loan,
  drumknott: playTwo,
  'ponder-stibbons': playTwo,
  'history-monks': {
    start(api) {
      api.lock();
      const pile = api.rnd.shuffle(api.G.discard);
      const take = pile.splice(0, 4);
      api.G.discard = pile;
      api.G.players[api.pid].hand.push(...take);
      say(api, `берёт из сброса карт: ${take.length}`);
      return null;
    },
  },
});
```
`packages/engine/src/cards/index.ts` — добавить строку `import './instant';`.


- [ ] **Step 4: Тесты проходят**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 1: карты без выбора

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Пачка 2 — своя рука (5 карт)

**Files:**
- Create: `packages/engine/src/cards/hand.ts`, `packages/engine/src/cards/hand.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './hand';`)

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/hand.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

const withHand = (cards: string[]) => (G: any) => { G.players['0'].hand.push(...cards); };

describe('пачка 2: своя рука', () => {
  for (const id of ['modo', 'luggage']) {
    it(`${id}: сбросить одну`, () => {
      const s = scenario(id, { setup: withHand(['a', 'b']) });
      s.start();
      expect(s.prompt()).toMatchObject({ kind: 'hand', min: 1, max: 1 });
      expect(s.answer('0', ['b'])).toBeNull();
      expect(s.G.players['0'].hand).toEqual(['a']);
      expect(s.G.discard).toContain('b');
    });
  }

  it('гарри король: $2 за каждую сброшенную', () => {
    const s = scenario('harry-king', { setup: withHand(['a', 'b', 'c']) });
    s.start();
    s.answer('0', ['a', 'c']);
    expect(s.G.players['0'].money).toBe(14);
  });

  it('магазинчик: $1 за каждую, можно ноль', () => {
    const s = scenario('shonky-shop', { setup: withHand(['a']) });
    s.start();
    expect(s.answer('0', [])).toBeNull();
    expect(s.G.players['0'].money).toBe(10);
  });

  it('алхимики: сбросить до трёх и добрать до пяти', () => {
    const s = scenario('alchemist-guild', { setup: withHand(['a', 'b', 'c', 'd']) });
    s.start();
    expect(s.answer('0', ['a', 'b', 'c', 'd'])).not.toBeNull();
    expect(s.answer('0', ['a', 'b'])).toBeNull();
    expect(s.G.players['0'].hand).toHaveLength(5);
  });

  it('пустая рука — эффект пропускается', () => {
    const s = scenario('modo');
    expect(s.start()).toBeNull();
    expect(s.prompt()).toBeNull();
  });
});
```

- [ ] **Step 2: Тесты падают** — `npm test`, Expected: FAIL.

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/hand.ts`:
```ts
import { refillHand } from '../turn';
import { defineEffects, type Effect } from './run';
import { ask, cardNames, moveCards, say } from './ops';

const discard = (min: number, max: number | undefined, text: string, after?: (api: any, n: number) => void): Effect => ({
  start: (api) => ask(api, { step: 'discard', kind: 'hand', options: [], min, max, text }),
  answer(api, _p, c) {
    const cards = c as string[];
    moveCards(api.G, api.pid, 'discard', cards);
    say(api, cards.length ? `сбрасывает ${cardNames(cards)}` : 'ничего не сбрасывает');
    after?.(api, cards.length);
    return null;
  },
});

const forMoney = (per: number) => (api: any, n: number) => {
  api.G.players[api.pid].money += per * n;
  say(api, `+$${per * n}`);
};

defineEffects({
  modo: discard(1, 1, 'Сбросьте одну карту'),
  luggage: discard(1, 1, 'Сбросьте одну карту'),
  'harry-king': discard(0, undefined, 'Сбросьте любое число карт: $2 за каждую', forMoney(2)),
  'shonky-shop': discard(0, undefined, 'Сбросьте любое число карт: $1 за каждую', forMoney(1)),
  'alchemist-guild': discard(0, 3, 'Сбросьте до трёх карт — затем доберёте руку до пяти', (api) => {
    api.lock();
    refillHand(api.G, api.pid);
    say(api, 'добирает руку до пяти');
  }),
});
```
`index.ts`: `import './hand';`.

- [ ] **Step 4: Тесты проходят** — `npm test`, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 2: своя рука

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Пачка 3 — выбор игрока (7 карт)

**Files:**
- Create: `packages/engine/src/cards/players.ts`, `packages/engine/src/cards/players.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './players';`)

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/players.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 3: выбор игрока', () => {
  it('нобби ноббс: $3 у выбранного', () => {
    const s = scenario('nobby-nobbs');
    s.start();
    expect(s.prompt()).toMatchObject({ kind: 'player', options: ['1', '2'] });
    s.answer('0', '2');
    expect([s.G.players['0'].money, s.G.players['2'].money]).toEqual([13, 7]);
  });

  it('хьюберт: A платит B $3, себя выбрать нельзя', () => {
    const s = scenario('hubert', { players: 4 });
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.options).toEqual(['2', '3']);
    s.answer('0', '3');
    expect([s.G.players['1'].money, s.G.players['3'].money]).toEqual([7, 13]);
  });

  it('заведующий кафедрой: обмен руками', () => {
    const s = scenario('chair-of-indefinite-studies', { setup: (G) => { G.players['0'].hand.push('x'); } });
    const theirs = [...s.G.players['1'].hand];
    s.start();
    s.answer('0', '1');
    expect(s.G.players['0'].hand).toEqual(theirs);
    expect(s.G.players['1'].hand).toEqual(['x']);
  });

  it('особисты: посмотреть руку и сбросить карту', () => {
    const s = scenario('cable-street-particulars');
    const theirs = [...s.G.players['2'].hand];
    s.start();
    s.answer('0', '2');
    expect(s.prompt()).toMatchObject({ kind: 'reveal', reveal: theirs, options: theirs, locked: true });
    s.answer('0', theirs[1]);
    expect(s.G.players['2'].hand).not.toContain(theirs[1]);
    expect(s.G.discard).toContain(theirs[1]);
  });

  it('стэнли: две случайные, одну оставить', () => {
    const s = scenario('stanley');
    const [a, b] = s.G.players['1'].hand;
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.options).toEqual([a, b]);
    s.answer('0', b);
    expect(s.G.players['0'].hand).toEqual([b]);
    expect(s.G.players['1'].hand).toContain(a);
    expect(s.G.players['1'].hand).toHaveLength(4);
  });

  it('миссис кейк: все неиспользованные личности, кроме одной', () => {
    const s = scenario('mrs-cake');
    s.start();
    const p = s.prompt()!;
    expect(p.kind).toBe('reveal');
    expect(p.reveal).toHaveLength(s.G.spare.length - 1);
    expect(s.answer('0', 'ok')).toBeNull();
  });

  it('зорго: заменить личность или оставить', () => {
    const s = scenario('zorgo-the-retrophrenologist');
    const before = s.G.players['0'].personality;
    s.start();
    s.answer('0', 'swap');
    expect(s.G.players['0'].personality).not.toBe(before);
    expect(s.G.spare).toContain(before);
  });
});
```

- [ ] **Step 2: Тесты падают** — `npm test`, FAIL.

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/players.ts`:
```ts
import type { PersonalityId } from '../types';
import { nameOf } from '../helpers';
import { defineEffects, type Effect, type EffectApi } from './run';
import { ask, pay, say } from './ops';

const choosePlayer = (api: EffectApi, step: string, text: string, filter: (p: string) => boolean = () => true, data = {}) =>
  ask(api, { step, kind: 'player', options: api.others.filter(filter), text, data });

const withCards = (api: EffectApi) => (p: string) => api.G.players[p].hand.length > 0;

defineEffects({
  'nobby-nobbs': {
    start: (api) => choosePlayer(api, 'who', 'У кого взять $3?'),
    answer(api, _p, c) {
      say(api, `берёт $${pay(api.G, c as string, api.pid, 3)} у игрока ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  hubert: {
    start: (api) => choosePlayer(api, 'payer', 'Кто заплатит $3?'),
    answer(api, p, c) {
      if (p.step === 'payer') {
        return choosePlayer(api, 'payee', `Кому ${nameOf(api.G, c as string)} заплатит $3?`, (o) => o !== c, { payer: c });
      }
      const n = pay(api.G, p.data.payer, c as string, 3);
      say(api, `${nameOf(api.G, p.data.payer)} платит $${n} игроку ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  'chair-of-indefinite-studies': {
    start: (api) => choosePlayer(api, 'who', 'С кем обменяться картами в руке?'),
    answer(api, _p, c) {
      api.lock();
      const me = api.G.players[api.pid];
      const them = api.G.players[c as string];
      [me.hand, them.hand] = [them.hand, me.hand];
      say(api, `меняется картами в руке с игроком ${nameOf(api.G, c as string)}`);
      return null;
    },
  },

  'cable-street-particulars': {
    start: (api) => choosePlayer(api, 'who', 'Чью руку посмотреть?', withCards(api)),
    answer(api, p, c) {
      if (p.step === 'who') {
        api.lock();
        const hand = [...api.G.players[c as string].hand];
        say(api, `смотрит карты игрока ${nameOf(api.G, c as string)}`);
        return ask(api, { step: 'pick', kind: 'reveal', options: hand, reveal: hand, locked: true,
          text: `Карты игрока ${nameOf(api.G, c as string)}: выберите одну для сброса`, data: { who: c } });
      }
      const hand = api.G.players[p.data.who].hand;
      hand.splice(hand.indexOf(c as string), 1);
      api.G.discard.push(c as string);
      say(api, `сбрасывает карту игрока ${nameOf(api.G, p.data.who)}`);
      return null;
    },
  },

  stanley: {
    start: (api) => choosePlayer(api, 'who', 'У кого вытянуть две карты?', withCards(api)),
    answer(api, p, c) {
      if (p.step === 'who') {
        api.lock();
        const hand = api.G.players[c as string].hand;
        const picked = api.rnd.shuffle(hand).slice(0, 2);
        for (const x of picked) hand.splice(hand.indexOf(x), 1);
        say(api, `тянет карты у игрока ${nameOf(api.G, c as string)}`);
        return ask(api, { step: 'keep', kind: 'reveal', options: picked, reveal: picked, locked: true,
          text: 'Какую карту оставить себе? Другая вернётся владельцу', data: { who: c, picked } });
      }
      api.G.players[api.pid].hand.push(c as string);
      for (const x of p.data.picked as string[]) if (x !== c) api.G.players[p.data.who].hand.push(x);
      say(api, 'оставляет себе одну карту');
      return null;
    },
  },

  'mrs-cake': {
    start(api) {
      if (api.G.spare.length < 2) { say(api, 'неиспользованных личностей слишком мало'); return null; }
      api.lock();
      const shown = api.rnd.shuffle(api.G.spare).slice(0, api.G.spare.length - 1);
      say(api, 'смотрит неиспользованные личности');
      return ask(api, { step: 'look', kind: 'reveal', options: ['ok'], reveal: shown, locked: true,
        text: 'Неиспользованные личности (кроме одной)' });
    },
    answer: () => null,
  },

  'zorgo-the-retrophrenologist': {
    start: (api) => (api.G.spare.length
      ? ask(api, { step: 'swap', kind: 'choice', options: ['swap', 'keep'],
          labels: { swap: 'Заменить личность на случайную', keep: 'Оставить свою' }, text: 'Заменить свою личность?' })
      : null),
    answer(api, _p, c) {
      if (c === 'keep') return null;
      api.lock();
      const pick = api.rnd.shuffle(api.G.spare)[0] as PersonalityId;
      const mine = api.G.players[api.pid].personality!;
      api.G.spare = api.G.spare.map((s) => (s === pick ? mine : s));
      api.G.players[api.pid].personality = pick;
      say(api, 'меняет свою личность на случайную');
      return null;
    },
  },
});
```
`index.ts`: `import './players';`.

- [ ] **Step 4: Тесты проходят** — `npm test`, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 3: выбор игрока

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Пачка 4 — поле (22 карты)

**Files:**
- Create: `packages/engine/src/cards/board.ts`, `packages/engine/src/cards/board.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './board';`)

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/board.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 4: поле', () => {
  for (const id of ['duckman', 'foul-ole-ron', 'canting-crew']) {
    it(`${id}: чужой слуга в соседний район`, () => {
      const s = scenario(id);
      s.start();
      expect(s.prompt()?.options).not.toContain('1:minion:0');
      expect(s.answer('0', '1:minion:1')).toBeNull();
      expect(s.prompt()?.options).toEqual([2, 3, 12]);
      s.answer('0', 2);
      expect([s.G.areas[1].minions['1'], s.G.areas[2].minions['1']]).toEqual([0, 1]);
      expect(s.G.areas[1].trouble).toBe(false);
    });
  }

  it('ринсвинд: свой слуга из района с беспорядком в соседний', () => {
    const s = scenario('rincewind');
    s.start();
    expect(s.prompt()?.options).toEqual(['1:minion:0', '5:minion:0', '7:minion:0']);
  });

  for (const id of ['dorfl', 'adora-belle-dearheart']) {
    it(`${id}: свой слуга в любой район`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', '5:minion:0');
      expect(s.prompt()?.options).toHaveLength(11);
      s.answer('0', 9);
      expect(s.G.areas[9].minions['0']).toBe(1);
    });
  }

  it('конюшни хобсона: $2 игроку, затем перемещение', () => {
    const s = scenario('hobson-livery-stables');
    s.start();
    s.answer('0', '1');
    expect(s.G.players['1'].money).toBe(12);
    expect(s.prompt()?.kind).toBe('piece');
  });

  for (const id of ['mr-shine', 'deep-dwarves']) {
    it(`${id}: слуга в любой район без беспорядка`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', 1);
      expect(s.G.areas[1].minions['0']).toBe(2);
    });
  }

  it('вилликинс: только район со своим зданием', () => {
    const s = scenario('willikins', { setup: (G) => { G.areas[4].building = '0'; } });
    s.start();
    expect(s.prompt()?.options).toEqual([4]);
  });

  it('дымящий гну: только район с беспорядком', () => {
    const s = scenario('smoking-gnu');
    s.start();
    expect(s.prompt()?.options).toEqual([1, 5, 7]);
  });

  it('ридкулли: двух слуг во Внедвижимость или соседний', () => {
    const s = scenario('archchancellor-ridcully');
    s.start();
    expect(s.prompt()?.options).toEqual([2, 1, 3, 4, 10, 11, 12]);
    s.answer('0', 2);
    expect(s.prompt()).not.toBeNull();
    s.answer('0', 3);
    expect([s.G.areas[2].minions['0'], s.G.areas[3].minions['0']]).toEqual([1, 1]);
  });

  it('декан: убрать слугу из Внедвижимости', () => {
    const s = scenario('dean-of-pentacles', { setup: (G) => { G.areas[2].minions['2'] = 1; } });
    s.start();
    s.answer('0', '2:minion:2');
    expect(s.G.areas[2].minions['2']).toBe(0);
  });

  it('доктор хикс и толпа: беспорядок', () => {
    const a = scenario('dr-hicks');
    a.start();
    a.answer('0', 9);
    expect(a.G.areas[9].trouble).toBe(true);
    const b = scenario('the-mob');
    b.start();
    expect(b.prompt()?.options).toEqual([2, 3, 4, 6, 8, 10, 12]);
  });

  it('казначей: поменять двух слуг местами', () => {
    const s = scenario('bursar');
    s.start();
    s.answer('0', '1:minion:1');
    s.answer('0', '5:minion:2');
    expect([s.G.areas[1].minions['2'], s.G.areas[5].minions['1']]).toEqual([2, 2]);
  });

  it('мистер слэнт: $2 за слугу в районе с беспорядком', () => {
    const s = scenario('mr-slant');
    s.start();
    s.answer('0', 1);
    expect(s.G.players['0'].money).toBe(16);
  });

  it('крошка безумный артур: здание за полцены', () => {
    const s = scenario('wee-mad-arthur', { setup: (G) => { G.areas[2].minions['0'] = 1; } });
    s.start();
    expect(s.prompt()?.options).toEqual([2]);
    s.answer('0', 2);
    expect([s.G.areas[2].building, s.G.players['0'].money]).toEqual(['0', 1]);
  });

  it('сибилла: замена чужого здания без беспорядка с компенсацией', () => {
    const s = scenario('sybil-vimes', { setup: (G) => { G.areas[3].building = '1'; G.players['0'].money = 20; } });
    s.start();
    s.answer('0', '3:building:1');
    expect(s.G.areas[3].building).toBe('0');
    expect([s.G.players['0'].money, s.G.players['1'].money]).toEqual([8, 22]);
  });

  it('ричер гилт: только район с беспорядком', () => {
    const s = scenario('reacher-gilt', { setup: (G) => { G.areas[3].building = '1'; G.areas[7].building = '2'; } });
    s.start();
    expect(s.prompt()?.options).toEqual(['7:building:2']);
  });

  it('бёрли и стронг: $2 игроку, затем убрать слугу', () => {
    const s = scenario('burleigh-and-stronginthearm');
    s.start();
    s.answer('0', '2');
    s.answer('0', '5:minion:1');
    expect(s.G.areas[5].minions['1']).toBe(0);
    expect(s.G.players['2'].money).toBe(12);
  });
});
```

- [ ] **Step 2: Тесты падают** — `npm test`, FAIL.

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/board.ts`:
```ts
import type { AMState, AreaId, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { nameOf } from '../helpers';
import { troubleAreas } from '../rules';
import { defineEffects, type Effect, type EffectApi } from './run';
import { ask, isMinionLike, moveMinion, parsePiece, pay, pieceName, pieces, putMinion, removePiece, say, type PieceRef } from './ops';

const UNREAL = 2;
const unrealOrAdjacent = () => [UNREAL, ...areaDef(UNREAL).adjacent];
const minionKeys = (G: AMState, f: (p: PieceRef) => boolean) => pieces(G, (p) => p.kind === 'minion' && f(p));

/** Переместить слугу: сначала фишка, потом район-цель. */
function moveEffect(o: {
  which: (G: AMState, pid: PlayerID) => string[];
  targets: (G: AMState, from: AreaId) => AreaId[];
  text: string;
}): Effect {
  return {
    start: (api) => ask(api, { step: 'piece', kind: 'piece', options: o.which(api.G, api.pid), text: o.text }),
    answer(api, p, c) {
      if (p.step === 'piece') {
        const from = parsePiece(c as string).area;
        return ask(api, { step: 'to', kind: 'area', options: o.targets(api.G, from), text: 'Куда переместить?', data: { piece: c } });
      }
      const pc = parsePiece(p.data.piece);
      moveMinion(api.G, pc.owner!, pc.area, c as number);
      say(api, `${pieceName(api.G, pc)} → ${areaDef(c as number).name}`);
      return null;
    },
  };
}

const otherAdjacent = moveEffect({
  which: (G, pid) => minionKeys(G, (p) => p.owner !== pid),
  targets: (_G, from) => areaDef(from).adjacent,
  text: 'Выберите слугу другого игрока — он переместится в соседний район',
});
const ownAnywhere = moveEffect({
  which: (G, pid) => minionKeys(G, (p) => p.owner === pid),
  targets: (_G, from) => AREA_IDS.filter((id) => id !== from),
  text: 'Выберите своего слугу для перемещения в любой район',
});

/** Поставить слугу в район из списка; times — сколько раз (Ридкулли — 2). */
function placeEffect(text: string, areas: (G: AMState, pid: PlayerID) => AreaId[], trouble: boolean, times = 1): Effect {
  const prompt = (api: EffectApi, left: number) => {
    if (api.G.players[api.pid].minionSupply < 1) { say(api, 'нет слуг в запасе'); return null; }
    return ask(api, { step: 'place', kind: 'area', options: areas(api.G, api.pid), text, data: { left } });
  };
  return {
    start: (api) => prompt(api, times),
    answer(api, p, c) {
      putMinion(api.G, api.pid, c as number, trouble);
      say(api, `ставит слугу: ${areaDef(c as number).name}${trouble ? '' : ' (без беспорядка)'}`);
      return p.data.left > 1 ? prompt(api, p.data.left - 1) : null;
    },
  };
}

/** Поставить беспорядок в район из списка. */
function troubleEffect(text: string, areas: (G: AMState) => AreaId[]): Effect {
  return {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: areas(api.G), text }),
    answer(api, _p, c) {
      api.G.areas[c as number].trouble = true;
      say(api, `кладёт беспорядок: ${areaDef(c as number).name}`);
      return null;
    },
  };
}

/** Заменить чужое здание своим с компенсацией владельцу (Сибилла — без беспорядка, Позолот — с ним). */
function replaceBuilding(withTrouble: boolean): Effect {
  return {
    start(api) {
      const me = api.G.players[api.pid];
      const opts = me.buildingSupply < 1 ? [] : pieces(api.G, (p) =>
        p.kind === 'building' && p.owner !== api.pid && api.G.areas[p.area].trouble === withTrouble && me.money >= areaDef(p.area).cost);
      return ask(api, { step: 'b', kind: 'piece', options: opts, text: 'Выберите чужое здание для замены своим' });
    },
    answer(api, _p, c) {
      const pc = parsePiece(c as string);
      const cost = areaDef(pc.area).cost;
      pay(api.G, api.pid, pc.owner!, cost);
      api.G.players[pc.owner!].buildingSupply++;
      api.G.players[api.pid].buildingSupply--;
      api.G.areas[pc.area].building = api.pid;
      say(api, `заменяет ${pieceName(api.G, pc)} своим зданием, платит владельцу $${cost}`);
      return null;
    },
  };
}

/** Заплатить выбранному игроку $2, затем продолжить другим эффектом. */
function payThen(next: Effect): Effect {
  return {
    start(api) {
      if (api.G.players[api.pid].money < 2) { say(api, 'не хватает $2'); return null; }
      return ask(api, { step: 'payee', kind: 'player', options: api.others, text: 'Кому заплатить $2?' });
    },
    answer(api, p, c) {
      if (p.step === 'payee') {
        pay(api.G, api.pid, c as string, 2);
        say(api, `платит $2 игроку ${nameOf(api.G, c as string)}`);
        return next.start(api);
      }
      return next.answer!(api, p, c);
    },
  };
}

const removeAny: Effect = {
  start: (api) => ask(api, { step: 'victim', kind: 'piece', options: pieces(api.G, isMinionLike), text: 'Выберите фишку, которую убрать' }),
  answer(api, _p, c) {
    const pc = parsePiece(c as string);
    removePiece(api.G, pc);
    say(api, `убирает: ${pieceName(api.G, pc)}`);
    return null;
  },
};

defineEffects({
  duckman: otherAdjacent,
  'foul-ole-ron': otherAdjacent,
  'canting-crew': otherAdjacent,
  rincewind: moveEffect({
    which: (G, pid) => minionKeys(G, (p) => p.owner === pid && G.areas[p.area].trouble),
    targets: (_G, from) => areaDef(from).adjacent,
    text: 'Выберите своего слугу из района с беспорядком — он уйдёт в соседний',
  }),
  dorfl: ownAnywhere,
  'adora-belle-dearheart': ownAnywhere,
  'hobson-livery-stables': payThen(ownAnywhere),
  'mr-shine': placeEffect('Куда поставить слугу (без беспорядка)?', () => AREA_IDS, false),
  'deep-dwarves': placeEffect('Куда поставить слугу (без беспорядка)?', () => AREA_IDS, false),
  willikins: placeEffect('Куда поставить слугу (район с вашим зданием)?', (G, pid) => AREA_IDS.filter((id) => G.areas[id].building === pid), true),
  'smoking-gnu': placeEffect('Куда поставить слугу (район с беспорядком)?', (G) => troubleAreas(G), true),
  'archchancellor-ridcully': placeEffect('Куда поставить слугу (Внедвижимость или соседний)? Второй — по желанию', unrealOrAdjacent, true, 2),
  'senior-wrangler': placeEffect('Куда поставить слугу (Внедвижимость или соседний)?', unrealOrAdjacent, true),
  'dean-of-pentacles': {
    start: (api) => ask(api, { step: 'victim', kind: 'piece', options: minionKeys(api.G, (p) => p.area === UNREAL), text: 'Какого слугу убрать из Внедвижимости?' }),
    answer: removeAny.answer,
  },
  'dr-hicks': troubleEffect('Куда положить беспорядок?', (G) => AREA_IDS.filter((id) => !G.areas[id].trouble)),
  'the-mob': troubleEffect('Куда положить беспорядок (рядом с районом, где он уже есть)?', (G) =>
    AREA_IDS.filter((id) => !G.areas[id].trouble && areaDef(id).adjacent.some((n) => G.areas[n].trouble))),
  bursar: {
    start: (api) => ask(api, { step: 'a', kind: 'piece', options: minionKeys(api.G, () => true), text: 'Первый слуга для обмена местами' }),
    answer(api, p, c) {
      if (p.step === 'a') {
        const area = parsePiece(c as string).area;
        return ask(api, { step: 'b', kind: 'piece', options: minionKeys(api.G, (x) => x.area !== area), text: 'Второй слуга (в другом районе)', data: { a: c } });
      }
      const a = parsePiece(p.data.a);
      const b = parsePiece(c as string);
      // По FAQ: оба снимаются, затем ставятся на места друг друга с проверкой беспорядков.
      api.G.areas[a.area].minions[a.owner!]--;
      api.G.areas[a.area].trouble = false;
      api.G.areas[b.area].minions[b.owner!]--;
      api.G.areas[b.area].trouble = false;
      api.G.players[a.owner!].minionSupply++;
      api.G.players[b.owner!].minionSupply++;
      putMinion(api.G, a.owner!, b.area);
      putMinion(api.G, b.owner!, a.area);
      say(api, `меняет местами: ${pieceName(api.G, a)} ↔ ${pieceName(api.G, b)}`);
      return null;
    },
  },
  'mr-slant': {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: troubleAreas(api.G), text: 'Выберите район с беспорядком: $2 за каждого слугу в нём' }),
    answer(api, _p, c) {
      const n = Object.values(api.G.areas[c as number].minions).reduce((s, x) => s + x, 0);
      api.G.players[api.pid].money += 2 * n;
      say(api, `+$${2 * n} (${areaDef(c as number).name})`);
      return null;
    },
  },
  'wee-mad-arthur': {
    start(api) {
      const me = api.G.players[api.pid];
      const opts = me.buildingSupply < 1 ? [] : AREA_IDS.filter((id) => {
        const a = api.G.areas[id];
        return a.minions[api.pid] > 0 && !a.trouble && a.building === null && me.money >= Math.ceil(areaDef(id).cost / 2);
      });
      return ask(api, { step: 'area', kind: 'area', options: opts, text: 'Где построить здание за полцены?' });
    },
    answer(api, _p, c) {
      const cost = Math.ceil(areaDef(c as number).cost / 2);
      api.G.players[api.pid].money -= cost;
      api.G.players[api.pid].buildingSupply--;
      api.G.areas[c as number].building = api.pid;
      say(api, `строит здание за $${cost}: ${areaDef(c as number).name}`);
      return null;
    },
  },
  'sybil-vimes': replaceBuilding(false),
  'reacher-gilt': replaceBuilding(true),
  'burleigh-and-stronginthearm': payThen(removeAny),
});
```
`index.ts`: `import './board';`.

Тест «Казначей»: после обмена в районе 1 у игрока '2' два слуги (свой + пришедший), в районе 5 у '1' — два. Если `putMinion` вернул запас, проверить, что `minionSupply` у обоих не изменился итогом.

- [ ] **Step 4: Тесты проходят** — `npm test`, PASS. Если ожидания по спискам районов в тестах расходятся с таблицей соседства — исправить тест по `areas.ts`, не движок.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 4: поле

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Пачка 5 — кубик (4 карты)

**Files:**
- Create: `packages/engine/src/cards/dice.ts`, `packages/engine/src/cards/dice.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './dice';`)

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/dice.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 5: кубик', () => {
  it('достабль: 7+ — $4', () => {
    const s = scenario('cmot-dibbler', { rolls: [9] });
    s.start();
    expect(s.G.players['0'].money).toBe(14);
  });

  it('достабль: 1 — $1 в банк и убрать своего слугу', () => {
    const s = scenario('cmot-dibbler', { rolls: [1] });
    s.start();
    expect(s.G.players['0'].money).toBe(9);
    expect(s.prompt()).toMatchObject({ kind: 'piece', locked: true });
    s.answer('0', '5:minion:0');
    expect(s.G.areas[5].minions['0']).toBe(0);
  });

  it('здесь-и-сейчас: 7+ — $3 у игрока', () => {
    const s = scenario('herennow', { rolls: [12] });
    s.start();
    s.answer('0', '2');
    expect(s.G.players['0'].money).toBe(13);
  });

  it('эррол: 7+ — убрать слугу из района с беспорядком', () => {
    const s = scenario('errol', { rolls: [7] });
    s.start();
    expect(s.prompt()?.options).toContain('7:minion:2');
    s.answer('0', '7:minion:2');
    expect(s.G.areas[7].minions['2']).toBe(0);
  });

  it('средний бросок — ничего', () => {
    const s = scenario('errol', { rolls: [4] });
    s.start();
    expect(s.prompt()).toBeNull();
  });

  it('карцер: из двух выпавших районов по слуге, обязательно', () => {
    const s = scenario('carcer', { rolls: [1, 9] });
    s.start();
    expect(s.prompt()).toMatchObject({ kind: 'piece', locked: true });
    s.answer('0', '1:minion:1');
    // в районе 9 никого — эффект завершён
    expect(s.prompt()).toBeNull();
    expect(s.G.areas[1].minions['1']).toBe(0);
  });
});
```

- [ ] **Step 2: Тесты падают** — `npm test`, FAIL.

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/dice.ts`:
```ts
import { areaDef } from '../data/areas';
import { nameOf } from '../helpers';
import { defineEffects, type EffectApi, type Next } from './run';
import { ask, isMinionLike, parsePiece, pay, pieceName, pieces, removePiece, say } from './ops';

function roll(api: EffectApi): number {
  api.lock();
  const r = api.rnd.d12();
  say(api, `на кубике ${r}`);
  return r;
}

const removeOwn = (api: EffectApi): Next =>
  ask(api, { step: 'kill', kind: 'piece', locked: true, text: 'Выпало 1: уберите одного своего слугу',
    options: pieces(api.G, (p) => p.kind === 'minion' && p.owner === api.pid) });

function killIn(api: EffectApi, areas: number[], i: number): Next {
  for (let k = i; k < areas.length; k++) {
    const opts = pieces(api.G, (p) => isMinionLike(p) && p.area === areas[k]);
    if (opts.length) {
      return ask(api, { step: 'kill', kind: 'piece', options: opts, locked: true,
        text: `Карцер: уберите слугу из района «${areaDef(areas[k]).name}»`, data: { areas, i: k } });
    }
  }
  return null;
}

const kill = (api: EffectApi, c: unknown) => {
  const pc = parsePiece(c as string);
  removePiece(api.G, pc);
  say(api, `убирает: ${pieceName(api.G, pc)}`);
};

defineEffects({
  'cmot-dibbler': {
    start(api) {
      const r = roll(api);
      if (r >= 7) { api.G.players[api.pid].money += 4; say(api, '+$4'); return null; }
      if (r === 1) { pay(api.G, api.pid, 'bank', 1); say(api, 'платит банку $1'); return removeOwn(api); }
      return null;
    },
    answer: (api, _p, c) => { kill(api, c); return null; },
  },
  herennow: {
    start(api) {
      const r = roll(api);
      if (r >= 7) return ask(api, { step: 'who', kind: 'player', options: api.others, locked: true, text: 'У кого взять $3?' });
      if (r === 1) return removeOwn(api);
      return null;
    },
    answer(api, p, c) {
      if (p.step === 'who') say(api, `берёт $${pay(api.G, c as string, api.pid, 3)} у игрока ${nameOf(api.G, c as string)}`);
      else kill(api, c);
      return null;
    },
  },
  errol: {
    start(api) {
      const r = roll(api);
      if (r >= 7) {
        return ask(api, { step: 'kill', kind: 'piece', locked: true, text: 'Уберите слугу из района с беспорядком',
          options: pieces(api.G, (p) => isMinionLike(p) && api.G.areas[p.area].trouble) });
      }
      if (r === 1) return removeOwn(api);
      return null;
    },
    answer: (api, _p, c) => { kill(api, c); return null; },
  },
  carcer: {
    start(api) {
      const areas = [roll(api), roll(api)];
      return killIn(api, areas, 0);
    },
    answer(api, p, c) {
      kill(api, c);
      return killIn(api, p.data.areas, p.data.i + 1);
    },
  },
});
```
`index.ts`: `import './dice';`.

- [ ] **Step 4: Тесты проходят** — `npm test`, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 5: кубик

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Пачка 6 — ответ соперника (10 карт)

**Files:**
- Create: `packages/engine/src/cards/respond.ts`, `packages/engine/src/cards/respond.test.ts`
- Modify: `packages/engine/src/cards/index.ts` (+ `import './respond';`), `packages/engine/src/game.test.ts`

- [ ] **Step 1: Тесты**

`packages/engine/src/cards/respond.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 6: ответ соперника', () => {
  for (const id of ['fools-guild', 'drwhiteface']) {
    it(`${id}: заплатить $5 или получить карту`, () => {
      const pay = scenario(id);
      pay.start();
      pay.answer('0', '1');
      expect(pay.prompt()).toMatchObject({ actor: '1', kind: 'choice', options: ['pay', 'take'] });
      expect(pay.answer('0', 'pay')).not.toBeNull(); // за соперника нельзя
      pay.answer('1', 'pay');
      expect([pay.G.players['0'].money, pay.G.players['1'].money]).toEqual([15, 5]);

      const take = scenario(id, { setup: (G) => { G.players['2'].money = 3; } });
      take.start();
      take.answer('0', '2');
      expect(take.prompt()?.options).toEqual(['take']);
      take.answer('2', 'take');
      expect(take.G.play?.toFront).toBe('2');
    });
  }

  it('пожарная бригада: отказ — можно убрать его здание', () => {
    const s = scenario('fire-brigade', { setup: (G) => { G.areas[3].building = '1'; } });
    s.start();
    expect(s.prompt()?.options).toEqual(['1']);
    s.answer('0', '1');
    s.answer('1', 'refuse');
    expect(s.prompt()).toMatchObject({ actor: '0', options: ['3:building:1'] });
    s.answer('0', '3:building:1');
    expect(s.G.areas[3].building).toBeNull();
  });

  for (const id of ['queen-molly', 'beggars-guild']) {
    it(`${id}: соперник отдаёт две карты на свой выбор`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', '1');
      const hand = [...s.G.players['1'].hand];
      expect(s.prompt()).toMatchObject({ actor: '1', kind: 'hand', min: 2, max: 2 });
      s.answer('1', hand.slice(0, 2));
      expect(s.G.players['0'].hand).toEqual(hand.slice(0, 2));
    });
  }

  for (const id of ['rosie-palm', 'seamstresses-guild']) {
    it(`${id}: отдать карту, получить $2`, () => {
      const s = scenario(id, { setup: (G) => { G.players['0'].hand.push('x'); } });
      s.start();
      s.answer('0', '2');
      s.answer('0', ['x']);
      expect(s.G.players['2'].hand).toContain('x');
      expect(s.G.players['0'].money).toBe(12);
    });
  }

  it('санаторий: каждый даёт $1 или карту на свой выбор', () => {
    const s = scenario('ankh-morpork-sunshine-dragon-sanctuary');
    s.start();
    expect(s.prompt()?.actor).toBe('1');
    s.answer('1', 'money');
    expect(s.prompt()?.actor).toBe('2');
    s.answer('2', 'card');
    const card = s.G.players['2'].hand[0];
    s.answer('2', [card]);
    expect(s.G.players['0'].money).toBe(11);
    expect(s.G.players['0'].hand).toContain(card);
    expect(s.prompt()).toBeNull();
  });

  it('аудиторы: каждый другой игрок убирает своего слугу', () => {
    const s = scenario('auditors');
    s.start();
    expect(s.prompt()).toMatchObject({ actor: '1', kind: 'piece' });
    s.answer('1', '1:minion:1');
    expect(s.prompt()?.actor).toBe('2');
    s.answer('2', '5:minion:2');
    expect([s.G.areas[1].minions['1'], s.G.areas[5].minions['2']]).toEqual([0, 0]);
  });

  it('космо лэвиш: $2 игроку, он убирает не вашего слугу из района с беспорядком', () => {
    const s = scenario('cosmo-lavish');
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.actor).toBe('1');
    expect(s.prompt()?.options).not.toContain('1:minion:0');
    s.answer('1', '7:minion:2');
    expect(s.G.areas[7].minions['2']).toBe(0);
    expect(s.G.players['1'].money).toBe(12);
  });
});
```

В `game.test.ts` — интеграционный тест ответа через Client:
```ts
describe('ответ соперника по сети', () => {
  it('отвечает только соперник', () => {
    const g: Game<AMState> = {
      ...testGame,
      setup: (args) => {
        const G = AnkhMorporkGame.setup!(args as never);
        for (const p of Object.values(G.players)) p.hand[0] = 'fools-guild';
        return G;
      },
    };
    const client = started(2, g);
    const cur = client.getState()!.ctx.currentPlayer;
    const other = cur === '0' ? '1' : '0';
    client.updatePlayerID(cur);
    client.moves.playCard('fools-guild');
    client.moves.startScroll();
    client.moves.answer(other);
    client.moves.answer('take'); // от имени текущего — отклонено
    expect(client.getState()!.G.prompt?.actor).toBe(other);
    client.updatePlayerID(other);
    client.moves.answer('take');
    expect(client.getState()!.G.prompt).toBeNull();
  });
});
```

- [ ] **Step 2: Тесты падают** — `npm test`, FAIL.

- [ ] **Step 3: Реализация**

`packages/engine/src/cards/respond.ts`:
```ts
import type { PlayerID } from '../types';
import { CARD_BY_ID } from '../data/cards';
import { nameOf } from '../helpers';
import { defineEffects, type Effect, type EffectApi, type Next } from './run';
import { ask, isMinionLike, moveCards, parsePiece, pay, pieceName, pieces, removePiece, say } from './ops';

const played = (api: EffectApi) => CARD_BY_ID[api.G.play!.cardId]?.name ?? '';

/** Гильдия шутов / Доктор Белолицый: заплатить $5 или получить карту перед собой. */
const payOrTake: Effect = {
  start: (api) => ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кого выбрать?' }),
  answer(api, p, c) {
    if (p.step === 'who') {
      const who = c as PlayerID;
      const labels: Record<string, string> = {};
      if (api.G.players[who].money >= 5) labels.pay = `Заплатить ${nameOf(api.G, api.pid)} $5`;
      labels.take = `Взять «${played(api)}» (будет лежать перед вами и занимать место в руке)`;
      return ask(api, { step: 'decide', kind: 'choice', actor: who, options: Object.keys(labels), labels,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { who } });
    }
    if (c === 'pay') {
      pay(api.G, p.data.who, api.pid, 5);
      say(api, `${nameOf(api.G, p.data.who)} платит $5`);
    } else {
      api.G.play!.toFront = p.data.who;
      say(api, `«${played(api)}» ляжет перед игроком ${nameOf(api.G, p.data.who)}`);
    }
    return null;
  },
};

/** Королева Молли / Гильдия нищих: соперник отдаёт две карты на свой выбор. */
const giveTwo: Effect = {
  start: (api) => ask(api, { step: 'who', kind: 'player', text: 'Кто отдаст вам две карты?',
    options: api.others.filter((o) => api.G.players[o].hand.length > 0) }),
  answer(api, p, c) {
    if (p.step === 'who') {
      const n = Math.min(2, api.G.players[c as string].hand.length);
      return ask(api, { step: 'give', kind: 'hand', actor: c as string, options: [], min: n, max: n,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»: отдайте ему ${n} карт(ы) на свой выбор` });
    }
    moveCards(api.G, p.actor, api.pid, c as string[]);
    say(api, `получает карт: ${(c as string[]).length} от игрока ${nameOf(api.G, p.actor)}`);
    return null;
  },
};

/** Розмари Палм / Гильдия белошвеек: отдать свою карту, получить $2. */
const sellCard: Effect = {
  start(api) {
    if (!api.G.players[api.pid].hand.length) { say(api, 'нечего отдать'); return null; }
    return ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кому отдать карту за $2?' });
  },
  answer(api, p, c) {
    if (p.step === 'who') {
      return ask(api, { step: 'card', kind: 'hand', options: [], min: 1, max: 1, text: 'Какую карту отдать?', data: { who: c } });
    }
    moveCards(api.G, api.pid, p.data.who, c as string[]);
    say(api, `отдаёт карту игроку ${nameOf(api.G, p.data.who)} и получает $${pay(api.G, p.data.who, api.pid, 2)}`);
    return null;
  },
};

/** Санаторий: каждый по очереди даёт $1 или карту на свой выбор. */
function nextDonor(api: EffectApi, i: number): Next {
  for (let k = i; k < api.others.length; k++) {
    const o = api.others[k];
    const labels: Record<string, string> = {};
    if (api.G.players[o].money >= 1) labels.money = `Дать ${nameOf(api.G, api.pid)} $1`;
    if (api.G.players[o].hand.length) labels.card = `Дать ${nameOf(api.G, api.pid)} одну карту`;
    if (Object.keys(labels).length) {
      return ask(api, { step: 'donor', kind: 'choice', actor: o, options: Object.keys(labels), labels,
        text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { i: k } });
    }
  }
  return null;
}

/** Аудиторы: каждый другой игрок по очереди убирает своего слугу. */
function nextVictim(api: EffectApi, i: number): Next {
  for (let k = i; k < api.others.length; k++) {
    const o = api.others[k];
    const opts = pieces(api.G, (p) => p.kind === 'minion' && p.owner === o);
    if (opts.length) {
      return ask(api, { step: 'victim', kind: 'piece', actor: o, options: opts,
        text: `«${played(api)}»: уберите одного своего слугу`, data: { i: k } });
    }
  }
  return null;
}

defineEffects({
  'fools-guild': payOrTake,
  drwhiteface: payOrTake,
  'fire-brigade': {
    start: (api) => ask(api, { step: 'who', kind: 'player', text: 'Кого выбрать (у кого есть здание)?',
      options: api.others.filter((o) => pieces(api.G, (p) => p.kind === 'building' && p.owner === o).length > 0) }),
    answer(api, p, c) {
      if (p.step === 'who') {
        const who = c as PlayerID;
        const labels: Record<string, string> = {};
        if (api.G.players[who].money >= 5) labels.pay = `Заплатить ${nameOf(api.G, api.pid)} $5`;
        labels.refuse = 'Не платить (вам могут убрать здание)';
        return ask(api, { step: 'decide', kind: 'choice', actor: who, options: Object.keys(labels), labels,
          text: `${nameOf(api.G, api.pid)} играет «${played(api)}»`, data: { who } });
      }
      if (p.step === 'decide') {
        if (c === 'pay') { pay(api.G, p.data.who, api.pid, 5); say(api, `${nameOf(api.G, p.data.who)} платит $5`); return null; }
        return ask(api, { step: 'burn', kind: 'piece', text: 'Какое здание убрать?',
          options: pieces(api.G, (x) => x.kind === 'building' && x.owner === p.data.who) });
      }
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `убирает: ${pieceName(api.G, pc)}`);
      return null;
    },
  },
  'queen-molly': giveTwo,
  'beggars-guild': giveTwo,
  'rosie-palm': sellCard,
  'seamstresses-guild': sellCard,
  'ankh-morpork-sunshine-dragon-sanctuary': {
    start: (api) => nextDonor(api, 0),
    answer(api, p, c) {
      if (p.step === 'donor' && c === 'money') {
        pay(api.G, p.actor, api.pid, 1);
        say(api, `${nameOf(api.G, p.actor)} даёт $1`);
        return nextDonor(api, p.data.i + 1);
      }
      if (p.step === 'donor') {
        return ask(api, { step: 'card', kind: 'hand', actor: p.actor, options: [], min: 1, max: 1,
          text: `Какую карту отдать игроку ${nameOf(api.G, api.pid)}?`, data: { i: p.data.i } });
      }
      moveCards(api.G, p.actor, api.pid, c as string[]);
      say(api, `${nameOf(api.G, p.actor)} даёт карту`);
      return nextDonor(api, p.data.i + 1);
    },
  },
  auditors: {
    start: (api) => nextVictim(api, 0),
    answer(api, p, c) {
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `убран ${pieceName(api.G, pc)}`);
      return nextVictim(api, p.data.i + 1);
    },
  },
  'cosmo-lavish': {
    start(api) {
      if (api.G.players[api.pid].money < 2) { say(api, 'не хватает $2'); return null; }
      return ask(api, { step: 'who', kind: 'player', options: api.others, text: 'Кому заплатить $2?' });
    },
    answer(api, p, c) {
      if (p.step === 'who') {
        pay(api.G, api.pid, c as string, 2);
        say(api, `платит $2 игроку ${nameOf(api.G, c as string)}`);
        return ask(api, { step: 'victim', kind: 'piece', actor: c as string,
          text: `«${played(api)}»: уберите слугу (не ${nameOf(api.G, api.pid)}) из района с беспорядком`,
          options: pieces(api.G, (x) => isMinionLike(x) && x.owner !== api.pid && api.G.areas[x.area].trouble) });
      }
      const pc = parsePiece(c as string);
      removePiece(api.G, pc);
      say(api, `${nameOf(api.G, p.actor)} убирает: ${pieceName(api.G, pc)}`);
      return null;
    },
  },
});
```

`index.ts`: `import './respond';`.

- [ ] **Step 4: Тесты проходят** — `npm test`, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src
git commit -m "Свитки, пачка 6: ответ соперника

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Автопартии с ответами и полнота реестра

**Files:**
- Modify: `packages/engine/src/game.test.ts`, `packages/engine/src/cards/run.test.ts`

- [ ] **Step 1: Тест полноты**

В `run.test.ts`:
```ts
import { CARDS } from '../data/cards';
import { hasEffect } from './run';
import './index';

it('у каждой карты со свитком есть эффект', () => {
  const missing = CARDS.filter((c) => c.symbols.some((s) => s.kind === 'scroll') && !hasEffect(c.id)).map((c) => c.id);
  expect(missing).toEqual([]);
});
```

- [ ] **Step 2: Бот в autoplay отвечает на вопросы**

В `game.test.ts` в функции `autoplay` перед `const pid = ctx.currentPlayer;` вставить:
```ts
    const pr = G.prompt;
    if (pr) {
      client.updatePlayerID(pr.actor);
      if (pr.kind === 'hand') client.moves.answer(G.players[pr.actor].hand.slice(0, pr.min ?? 0));
      else client.moves.answer(pick(pr.options));
      if (client.getState()!.G.prompt === pr) { client.updatePlayerID(ctx.currentPlayer); client.moves.skipSymbol(); }
      continue;
    }
    client.updatePlayerID(ctx.currentPlayer);
```
В ветке `switch (sym.kind)` добавить:
```ts
      case 'scroll': if (hasEffect(G.play.cardId)) client.moves.startScroll(); else client.moves.skipSymbol(); break;
```
Импорт `hasEffect` из `./cards`.

Карта `reveal` с `options: []` у бота невозможна: бот отвечает от имени `actor` в тестовой игре без `playerView`.

- [ ] **Step 3: Тесты проходят**

```bash
npm test
```
Expected: PASS, включая 9 автопартий. Если партия зависает — вывести `G.prompt` и `G.log.slice(-5)` на последнем шаге и починить эффект, который выдаёт вопрос без допустимого ответа.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src
git commit -m "Автопартии отвечают на вопросы свитков; проверка полноты реестра

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Интерфейс — плашка подсказки и выбор на поле

**Files:**
- Create: `packages/client/src/table/PromptBar.tsx`
- Modify: `packages/client/src/table/Table.tsx`, `packages/client/src/table/ActionPanel.tsx`, `packages/client/src/table/Hand.tsx`, `packages/client/src/styles.css`

**Interfaces:**
- Consumes: `G.prompt`, `hasEffect`, `parsePiece`, `pieceName`, ходы `startScroll`, `answer`, `skipSymbol`.
- Produces: `PromptBar({ G, ctx, me, moves, nameOf })`; в `Hand` — режим выбора (`select?: { min, max, onDone }`).

- [ ] **Step 1: PromptBar**

`packages/client/src/table/PromptBar.tsx`:
```tsx
import { CARD_BY_ID, currentSymbol, hasEffect, type AMState } from '@am/engine';
import { COLOR_HEX } from './assets';

/** Плашка над полем: что делать сейчас по тексту карты. */
export function PromptBar({ G, ctx, me, moves, nameOf }: {
  G: AMState; ctx: any; me: string | null; moves: any; nameOf: (pid: string) => string;
}) {
  const p = G.prompt;
  const sym = currentSymbol(G);
  if (!G.play || (!p && sym?.kind !== 'scroll')) return null;
  const card = CARD_BY_ID[G.play.cardId];
  const myTurn = me === ctx.currentPlayer;
  const auto = hasEffect(G.play.cardId);

  let body: React.ReactNode;
  if (!p) {
    body = myTurn ? (
      <>
        <span>{auto ? 'Разыграть текст карты?' : 'Текст карты выполняется вручную (✋)'}</span>
        {auto && <button className="btn" onClick={() => moves.startScroll()}>Выполнить</button>}
        <button className="btn ghost" onClick={() => moves.skipSymbol()}>{auto ? 'Пропустить' : 'Готово'}</button>
      </>
    ) : <span>{nameOf(ctx.currentPlayer)} разыгрывает текст карты…</span>;
  } else if (p.actor !== me) {
    body = <span>Ждём ответа: {nameOf(p.actor)}…</span>;
  } else {
    body = (
      <>
        <span>{p.text}</span>
        {p.kind === 'player' && p.options.map((o) => (
          <button key={o} className="btn player-pick" style={{ borderColor: COLOR_HEX[G.players[o]?.color ?? 'red'] }}
            onClick={() => moves.answer(o)}>{nameOf(String(o))}</button>
        ))}
        {p.kind === 'choice' && p.actor === ctx.currentPlayer && p.options.map((o) => (
          <button key={o} className="btn" onClick={() => moves.answer(o)}>{p.labels?.[o] ?? o}</button>
        ))}
        {(p.kind === 'area' || p.kind === 'piece') && <i>— выберите на поле</i>}
      </>
    );
  }

  return (
    <div className="prompt-bar">
      <b>«{card?.name}»</b>
      {body}
      {myTurn && p && !p.locked && <button className="btn ghost" onClick={() => moves.skipSymbol()}>Пропустить</button>}
    </div>
  );
}
```

- [ ] **Step 2: Table — подсветка по вопросу, выбор фишки**

В `packages/client/src/table/Table.tsx`:

Импорты: `parsePiece, pieceName` из `@am/engine`; `PromptBar` из `./PromptBar`.

После вычисления `highlight`/`onArea` по символам (до `onDropPiece`) вставить:
```tsx
  // Вопрос свитка важнее символа: подсветка и клики по полю идут в answer.
  const prompt = G.prompt;
  const myPrompt = prompt && prompt.actor === me ? prompt : null;
  if (myPrompt?.kind === 'area') {
    highlight = myPrompt.options as AreaId[];
    onArea = (id) => moves.answer(id);
  } else if (myPrompt?.kind === 'piece') {
    highlight = [...new Set(myPrompt.options.map((k) => parsePiece(String(k)).area))];
    onArea = setMenuArea;
  }
```
Условие подсветки символов (`else if (myTurn && sym && me && mine)`) дополнить `&& !prompt`.

В разметке: внутри `.table-board` первым элементом `<PromptBar G={G} ctx={ctx} me={me} moves={moves} nameOf={nameOf} />`.

Всплывашку выбора фишки по вопросу добавить рядом с попапом убийства:
```tsx
      {menuArea != null && myPrompt?.kind === 'piece' && (
        <div className="popup" onClick={() => setMenuArea(null)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h3>{myPrompt.text}</h3>
            {myPrompt.options.filter((k) => parsePiece(String(k)).area === menuArea).map((k) => (
              <button key={k} className="btn" onClick={() => { moves.answer(k); setMenuArea(null); }}>
                {pieceName(G, parsePiece(String(k)))}
              </button>
            ))}
            <button className="btn ghost" onClick={() => setMenuArea(null)}>Отмена</button>
          </div>
        </div>
      )}
```
Условие попапа убийства дополнить `&& !myPrompt`.

Выбор карт своей руки (вопрос `hand` у текущего игрока): передать в `Hand` проп
```tsx
select={myPrompt?.kind === 'hand' && me === ctx.currentPlayer
  ? { min: myPrompt.min ?? 0, max: myPrompt.max ?? 99, onDone: (cards: string[]) => moves.answer(cards) }
  : undefined}
```
и `open={handOpen || !!(myPrompt?.kind === 'hand' && me === ctx.currentPlayer)}`.

- [ ] **Step 3: Hand — режим выбора**

В `packages/client/src/table/Hand.tsx`:

Сигнатура: добавить проп `select?: { min: number; max: number; onDone: (cards: string[]) => void }`.

Состояние: `const [picked, setPicked] = useState<string[]>([]);` и сброс `useEffect(() => setPicked([]), [select?.min, select?.max, hand.length]);` (импорт `useEffect`).

Клик по карте: если `select` — переключать выбор (не больше `max`), иначе как раньше `onPlay`:
```tsx
              disabled={!select && !canPlay}
              className={`hand-card ${picked.includes(id) ? 'picked' : ''}`}
              onClick={() => {
                if (select) setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < select.max ? [...x, id] : x));
                else { setPreview(null); onPlay(id); }
              }}
```
Под картами при `select`:
```tsx
          {select && (
            <div className="hand-select">
              Выбрано {picked.length} из {select.min === select.max ? select.max : `${select.min}–${select.max}`}
              <button className="btn" disabled={picked.length < select.min} onClick={() => select.onDone(picked)}>Готово</button>
            </div>
          )}
```

- [ ] **Step 4: ActionPanel — свиток через плашку**

В `ActionPanel.tsx` ветку подсказки `(sym.kind === 'scroll' || sym.kind === 'interrupt')` заменить: для `scroll` — текст «Текст карты — см. подсказку над полем»; кнопку «Готово» оставить только для `interrupt`.

- [ ] **Step 5: Стили**

В конец `styles.css`:
```css
.prompt-bar { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 6; max-width: min(860px, 92%);
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px;
  background: #f6e7c1f5; border: 2px solid var(--brown); box-shadow: 0 6px 20px #0006; font-size: 1.05rem; }
.player-pick { background: #fffaf0; color: var(--ink); border-width: 3px; }
.hand-card.picked img { outline: 4px solid #2e8b2e; transform: translateY(-14px); }
.hand-select { align-self: center; display: flex; flex-direction: column; gap: 6px; padding: 0 8px; }
```

- [ ] **Step 6: Сборка и проверка**

```bash
npm run build
```
Перезапустить сервер. В хотсите сыграть карту со свитком «выбор района» (например, Доктора Хикса — нужную карту можно взять в руку вручную: «В сброс» ненужной и «Взять из сброса») и проверить: плашка, подсветка, ответ кликом; «Гарри Король» — выбор карт в руке и «Готово».

- [ ] **Step 7: Commit**

```bash
git add packages/client/src
git commit -m "Интерфейс свитков: плашка подсказки, выбор района, фишки, игрока и карт руки

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Интерфейс — ответ соперника, показ скрытого, хотсит

**Files:**
- Create: `packages/client/src/table/PromptModals.tsx`
- Modify: `packages/client/src/table/Table.tsx`, `packages/client/src/LocalGame.tsx`, `packages/client/src/styles.css`

**Interfaces:**
- Produces: `RespondModal`, `RevealModal`, `Handoff`, `SeatContext`.

- [ ] **Step 1: Модалки**

`packages/client/src/table/PromptModals.tsx`:
```tsx
import { createContext, useState } from 'react';
import { CARD_BY_ID, PERSONALITY_BY_ID, type AMState, type PersonalityId } from '@am/engine';
import { cardImg, personalityImg } from './assets';

/** В хотсите — переключить «сиденье» клиента на игрока. */
export const SeatContext = createContext<((pid: string) => void) | null>(null);

const imgOf = (id: string) => (id in PERSONALITY_BY_ID ? personalityImg(id as PersonalityId) : cardImg(id));
const nameOfCard = (id: string) => PERSONALITY_BY_ID[id as PersonalityId]?.name ?? CARD_BY_ID[id]?.name ?? id;

/** Вопрос сопернику (выбор кнопкой или карт из руки) — у того, кто отвечает. */
export function RespondModal({ G, me, moves }: { G: AMState; me: string | null; moves: any }) {
  const p = G.prompt;
  const [picked, setPicked] = useState<string[]>([]);
  if (!p || p.actor !== me || p.actor === undefined || (p.kind !== 'choice' && p.kind !== 'hand')) return null;
  const hand = G.players[me!].hand;
  return (
    <div className="popup">
      <div className="popup-box respond-box">
        {G.play && <img className="respond-card" src={cardImg(G.play.cardId)} alt={CARD_BY_ID[G.play.cardId]?.name} />}
        <div className="respond-body">
          <h3>{p.text}</h3>
          {p.kind === 'choice' && p.options.map((o) => (
            <button key={o} className="btn" onClick={() => moves.answer(o)}>{p.labels?.[o] ?? o}</button>
          ))}
          {p.kind === 'hand' && (
            <>
              <div className="reveal">
                {hand.map((c) => (
                  <button key={c} className={`hand-card ${picked.includes(c) ? 'picked' : ''}`}
                    onClick={() => setPicked((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < (p.max ?? 99) ? [...x, c] : x))}>
                    <img src={cardImg(c)} alt={nameOfCard(c)} />
                  </button>
                ))}
              </div>
              <button className="btn" disabled={picked.length < (p.min ?? 0)} onClick={() => { moves.answer(picked); setPicked([]); }}>
                Отдать ({picked.length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Показ скрытого: только тому, кто отвечает. */
export function RevealModal({ G, me, moves }: { G: AMState; me: string | null; moves: any }) {
  const p = G.prompt;
  if (!p || p.kind !== 'reveal' || p.actor !== me || !p.reveal) return null;
  const ok = p.options.length === 1 && p.options[0] === 'ok';
  return (
    <div className="popup">
      <div className="popup-box reveal-box">
        <h3>{p.text}</h3>
        <div className="reveal">
          {p.reveal.map((id) => (
            <figure key={id}>
              {ok ? <img src={imgOf(id)} alt={nameOfCard(id)} />
                : <button className="hand-card" onClick={() => moves.answer(id)}><img src={imgOf(id)} alt={nameOfCard(id)} /></button>}
            </figure>
          ))}
        </div>
        {ok && <button className="btn" onClick={() => moves.answer('ok')}>Понятно</button>}
      </div>
    </div>
  );
}

/** Хотсит: передать компьютер отвечающему. */
export function Handoff({ name, onReady }: { name: string; onReady: () => void }) {
  return (
    <div className="popup handoff">
      <div className="popup-box">
        <h2>Отвечает {name}</h2>
        <p>Передайте ему компьютер.</p>
        <button className="btn" onClick={onReady}>Я {name}, показать</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Table**

В `Table.tsx`: импорт `RespondModal, RevealModal, Handoff, SeatContext` из `./PromptModals`, `useContext` из React. Перед `<PeekModal …/>` добавить:
```tsx
      <RespondModal G={G} me={me} moves={moves} />
      <RevealModal G={G} me={me} moves={moves} />
```

`HotseatBoard` заменить:
```tsx
export function HotseatBoard(p: BoardProps<AMState>) {
  const setSeat = useContext(SeatContext);
  const { G, ctx } = p;
  const response = !!G.prompt && G.prompt.actor !== ctx.currentPlayer;
  const desired = ctx.phase === 'lobby' ? '0' : G.prompt?.actor ?? ctx.currentPlayer;
  const seat = p.playerID ?? ctx.currentPlayer;
  // Обычная смена хода — переключаемся сразу (рука в выдвижной панели, личность рубашкой вверх).
  useEffect(() => { if (setSeat && !response && desired !== seat) setSeat(desired); }, [setSeat, response, desired, seat]);
  const name = G.players[desired]?.name ?? `Игрок ${Number(desired) + 1}`;
  return (
    <>
      <Table G={G} ctx={ctx} moves={p.moves} undo={p.undo} me={seat} />
      {response && desired !== seat && setSeat && <Handoff name={name} onReady={() => setSeat(desired)} />}
    </>
  );
}
```

- [ ] **Step 3: LocalGame — сиденье**

`packages/client/src/LocalGame.tsx`: импорт `SeatContext` из `./table/PromptModals`; состояние `const [seat, setSeat] = useState('0');`; рендер клиента:
```tsx
  return (
    <SeatContext.Provider value={setSeat}>
      <HotseatClient matchID="local" playerID={seat} />
    </SeatContext.Provider>
  );
```

- [ ] **Step 4: Стили**

```css
.respond-box { flex-direction: row; gap: 16px; max-width: 900px; align-items: flex-start; }
.respond-card { height: min(60vh, 520px); border-radius: 10px; box-shadow: var(--shadow); }
.respond-body { display: flex; flex-direction: column; gap: 8px; min-width: 260px; }
.respond-body .reveal img, .reveal-box .reveal img { height: 200px; }
.handoff { background: #1a120bdd; z-index: 40; }
```

- [ ] **Step 5: Сборка и проверка в хотсите**

```bash
npm run build
```
Перезапустить сервер. Хотсит на 3: сыграть «Гильдию шутов» (взять из сброса вручную, если нет в руке): выбрать игрока → экран «Отвечает Игрок 2» → «Я Игрок 2» → окно с картой и кнопками → «Взять» → ход возвращается Игроку 1, карта после розыгрыша лежит перед Игроком 2. «Особисты» → окно с рукой соперника только у разыгрывающего.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src
git commit -m "Интерфейс свитков: ответ соперника, показ скрытого, передача компьютера в хотсите

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Проверка в браузере и по сети

**Files:**
- Modify: `scripts/hotseat-test.mjs`, `scripts/secrecy-test.mjs`

- [ ] **Step 1: Секретность по сети**

Скрытое в вопросах проверено на уровне движка (`run.test.ts`, «скрытое в вопросе видит только отвечающий»). По сети прогнать существующий тест:
```bash
node scripts/secrecy-test.mjs http://localhost:3001
```
Expected: `утечек нет`.

- [ ] **Step 2: Хотсит до победы и тесты**

```bash
npm test
npm run build
node scripts/hotseat-test.mjs http://localhost:3001
```
Expected: тесты PASS, `"gameover": "Победа: …"`. В `hotseat-test.mjs` функция `finishCard` должна нажимать и «Выполнить»/«Пропустить» в `.prompt-bar` — добавить в начало цикла:
```js
    if (await click('.prompt-bar button', 'Пропустить')) continue;
```

- [ ] **Step 3: Ручной прогон каждого типа шага**

В хотсите на 3 игрока (раздавая нужные карты вручную через «Взять из сброса» или просто играя) проверить по одной карте каждого типа: без выбора (Гекс), рука (Гарри Король), игрок (Нобби), поле (Утка, Казначей), кубик (Карцер), ответ соперника (Королева Молли, Аудиторы), скрытое (Особисты, Миссис Кейк). Каждая — без ошибок в консоли, лог понятный, «↶ Отменить» не откатывает шаги со скрытым.

- [ ] **Step 4: Commit**

```bash
git add scripts
git commit -m "Проверки в браузере учитывают плашку свитков

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
