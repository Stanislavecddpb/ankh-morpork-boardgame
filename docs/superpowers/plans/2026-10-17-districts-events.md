# Районы и события — план реализации

Спецификация: `docs/superpowers/specs/2026-10-17-districts-events-design.md`. Коммиты без соавторов.

## Задача 1. Машина эффектов с источником
- `types.ts`: `Prompt.origin`, `AMState.startOwners/districtsUsed/disabledDistricts/eventRolls`, `GameOver.reason` += `riots`.
- `setup.ts`, `turn.ts#startTurn`: инициализация полей.
- `cards/run.ts`: `settle(api, next, key, origin)`; `startScroll`, `answerPrompt` используют `origin`;
  `api.title` для `say()`.
- `turn.ts#skipSymbol`: отмена вопроса района.
- Тест: существующие 144 зелёные.

## Задача 2. Районы
- `data/areas.ts`: `river`.
- `districts.ts` (новый): `districtActive`, `usableDistricts`, эффекты `district:N`, `startDistrict(api, area)`.
- `game.ts`: ход `useDistrict` (client:false, undoable по `noUndo`).
- `manual.ts`: `toggleDistrict`.
- `districts.test.ts`: каждый район, условия доступности, отмена, «не в ход получения», демоны, отложенная карточка.

## Задача 3. События
- `events.ts` (новый): эффекты `event:<id>`, общий шаг защиты Мелких Богов, `startEvent(api)`.
- `turn.ts#doEvent` → `game.ts drawEvent` через `startEvent`.
- `victory.ts`: демоны в подсчёте и у Ветинари; `riots`.
- `events.test.ts`: каждое событие с заданными бросками, защита, Бунты.
- `game.test.ts`: автопрогоны отвечают на вопросы событий.

## Задача 4. Интерфейс
- Панель действий: кнопки районов; панель игроков: подсветка/серые карточки.
- Баннер события с бросками; надписи `riots` в итогах.
- Ручной режим: «отложить/вернуть карточку района».
- `scripts/scroll-test.mjs`: жмёт районы; прогон в браузере, README.
