# Прерывания — план реализации

Спецификация: `docs/superpowers/specs/2026-10-17-interrupts-design.md`. Коммиты без соавторов.

## Задача 1. Движок
- `types.ts`: `Loss`, `Offer`, `AMState.offers`, `AMState.lastPlayed`.
- `cards/interrupts.ts`: `snapshot`, `offerLosses(G, snap, source, current)`, `answerOffer(api, responder, choice)`,
  `mossyLawn(G, pid)`, `discardInterrupt(G, pid, card)`; Сонки-цель в `answerPrompt`.
- Точки вызова: `doAssassinate` (game.ts), `runEffect` (scroll и события Дракон/Джонсон/Убийства).
- Блокировки: `answerPrompt`, `turnOnly`, `canEndTurn`, `districtBlock` ждут, пока `offers` пусты.
- `game.ts`: ходы `interrupt`, `playInterrupt`, `mossyLawn`; `assassinate` без отмены при предложении.
- Тесты `cards/interrupts.test.ts`; автопартии отвечают на предложения.

## Задача 2. Интерфейс
- Окно предложения у пострадавшего (хотсит — передача компьютера), «Ждём ответа» у остальных.
- Кнопка «Сыграть прерывание» на карте в руке; Мосси Лаун — в свой ход.
- Браузерный бот жмёт предложения; README.
