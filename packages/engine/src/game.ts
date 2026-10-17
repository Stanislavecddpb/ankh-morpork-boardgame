import type { Game } from 'boardgame.io';
import { ActivePlayers, INVALID_MOVE } from 'boardgame.io/core';
import type { AMState, AreaId, Choice, Target } from './types';
import { applySetColor, applySetName, setupGame } from './setup';
import { drawCards, log, nameOf } from './helpers';
import {
  canEndTurn, doAssassinate, doBuild, doMinion, doMoney, doPlayAnother, doRemoveTrouble,
  playCard, refillHand, skipSymbol, startTurn,
} from './turn';
import { applyManual, eventBack, peekSpare, swapPersonality, takeRandomCard, type ManualAction } from './manual';
import { allPersonalities, deckOutResult, hasWon } from './victory';
import { playerView } from './view';
import {
  answerForAbsent, answerOffer, answerPrompt, makeApi, mossyLawn, offerLosses, playInterrupt, snapshot, startEvent, startScroll, useDistrict, type Rnd,
} from './cards';

export const GAME_ID = 'ankh-morpork';

const check = (error: string | null) => (error ? INVALID_MOVE : undefined);

/** В фазе play активны все (чтобы соперник мог отвечать); ходить может только текущий игрок. */
const ownTurn = <A extends unknown[]>(fn: (c: any, ...args: A) => any) =>
  (c: any, ...args: A): any => (c.playerID === c.ctx.currentPlayer ? fn(c, ...args) : INVALID_MOVE);
/** То же, но пока кто-то решает, играть ли прерывание, ход ждёт (ручной режим — нет). */
const turnOnly = <A extends unknown[]>(fn: (c: any, ...args: A) => any) =>
  ownTurn((c: any, ...args: A): any => (c.G.offers.length ? INVALID_MOVE : fn(c, ...args)));

/** Добор и передача хода (или конец игры, если колода кончилась). */
function endTurnWithRefill({ G, playerID, events }: any): void {
  refillHand(G, playerID);
  if (G.deck.length === 0) {
    G.gameover = deckOutResult(G);
    log(G, 'Колода закончилась — игра окончена');
    return;
  }
  events.endTurn();
}

/** Бросок d12 с записью в G.dice: первый бросок в действии начинает новую серию (новая анимация у всех). */
function rollD12(c: any): number {
  const v = c.random.D12();
  if (!c.__diceStarted) {
    c.G.dice = { seq: c.G.dice.seq + 1, values: [] };
    c.__diceStarted = true;
  }
  c.G.dice.values.push(v);
  return v;
}

/** Контекст эффекта свитка: от имени текущего игрока (владельца карты); случайность — random boardgame.io. */
function apiFor(c: any) {
  const rnd: Rnd = { d12: () => rollD12(c), shuffle: (a) => c.random.Shuffle(a) };
  return makeApi(c.G, c.ctx.currentPlayer, c.ctx.playOrder, rnd);
}

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
          // Первый игрок — по жребию, независимо от того, кто какое место занял в лобби.
          G.startIndex = random.Die(ctx.numPlayers) - 1;
          log(G, 'Игра началась');
          log(G, `Жребий: первым ходит ${nameOf(G, ctx.playOrder[G.startIndex])}`);
        },
      },
    },

    play: {
      turn: {
        activePlayers: ActivePlayers.ALL,
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
        playCard: turnOnly(({ G, playerID }, cardId: string) => check(playCard(G, playerID, cardId))),
        placeMinion: turnOnly(({ G, playerID }, area: AreaId, from?: AreaId) => check(doMinion(G, playerID, area, from))),
        build: turnOnly(({ G, playerID }, area: AreaId, from?: AreaId) => check(doBuild(G, playerID, area, from))),
        // Убийство чужого слуги может открыть предложение прерывания — тогда без отмены (раскрыта рука).
        assassinate: {
          move: turnOnly(({ G, playerID }, area: AreaId, target: Target) => {
            const snap = snapshot(G);
            if (doAssassinate(G, playerID, area, target)) return INVALID_MOVE;
            offerLosses(G, snap, 'assassinate', playerID);
            G.noUndo = G.offers.length > 0;
          }),
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },
        removeTrouble: turnOnly(({ G, playerID }, area: AreaId) => check(doRemoveTrouble(G, playerID, area))),
        takeMoney: turnOnly(({ G, playerID }) => check(doMoney(G, playerID))),
        playAnother: turnOnly(({ G, playerID }) => check(doPlayAnother(G, playerID))),
        skipSymbol: turnOnly(({ G, playerID }) => check(skipSymbol(G, playerID))),
        manual: ownTurn(({ G, playerID }, action: ManualAction) => check(applyManual(G, playerID, action))),

        // Прерывания: решает пострадавший (не текущий игрок), сбросить карту-прерывание может любой.
        interrupt: {
          move: (c: any, choice: string | number): any => {
            const api = apiFor(c);
            if (answerOffer(api, c.playerID, choice)) return INVALID_MOVE;
            c.G.noUndo = true;
          },
          client: false,
          undoable: false,
        },
        // Кто-то отошёл и не отвечает: текущий игрок отвечает за него (интерфейс даёт это после паузы).
        answerFor: {
          move: ownTurn((c) => {
            const api = apiFor(c);
            if (answerForAbsent(api)) return INVALID_MOVE;
            c.G.noUndo = true;
          }),
          client: false,
          undoable: false,
        },
        playInterrupt: {
          move: ({ G, playerID }: any, card: string): any => check(playInterrupt(G, playerID, card)),
          undoable: false,
        },
        mossyLawn: {
          move: turnOnly((c) => {
            if (mossyLawn(c.G, c.playerID)) return INVALID_MOVE;
            endTurnWithRefill(c);
          }),
          client: false,
          undoable: false,
        },

        startScroll: {
          move: turnOnly((c) => {
            const api = apiFor(c);
            if (startScroll(api)) return INVALID_MOVE;
            c.G.noUndo = api.locked;
          }),
          client: false,
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },
        // Способность района: может открыть карту из колоды — тогда без отмены.
        useDistrict: {
          move: turnOnly((c, area: AreaId) => {
            const api = apiFor(c);
            if (useDistrict(api, area)) return INVALID_MOVE;
            c.G.noUndo = api.locked;
          }),
          client: false,
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },
        // Отвечать может и соперник — поэтому без turnOnly; проверка actor внутри answerPrompt.
        answer: {
          move: (c: any, choice: Choice): any => {
            const api = apiFor(c);
            if (answerPrompt(api, c.playerID, choice)) return INVALID_MOVE;
            c.G.noUndo = api.locked;
          },
          client: false,
          undoable: ({ G }: { G: AMState }) => !G.noUndo,
        },

        // Открывают скрытое или случайное: только на сервере, отмена через них невозможна.
        drawEvent: {
          move: turnOnly((c) => {
            if (startEvent(apiFor(c))) return INVALID_MOVE;
            if (c.G.lastEvent) c.G.eventShow = { seq: c.G.eventShow.seq + 1, diceSeq: c.G.dice.seq };
          }),
          client: false,
          undoable: false,
        },
        manualDraw: {
          move: ownTurn(({ G, playerID }) => {
            if (drawCards(G, playerID, 1) === 0) return INVALID_MOVE;
            log(G, `✋ ${nameOf(G, playerID)}: берёт карту из колоды`);
          }),
          client: false,
          undoable: false,
        },
        manualTakeRandom: {
          move: ownTurn(({ G, playerID, random }, from: string) => check(takeRandomCard(G, playerID, from, random.Shuffle))),
          client: false,
          undoable: false,
        },
        manualEventBack: {
          move: ownTurn(({ G, playerID, random }, where: 'top' | 'shuffle') => check(eventBack(G, playerID, where, random.Shuffle))),
          client: false,
          undoable: false,
        },
        manualSwapPersonality: {
          move: ownTurn(({ G, playerID, random }) => check(swapPersonality(G, playerID, random.Shuffle))),
          client: false,
          undoable: false,
        },
        manualPeekSpare: {
          move: ownTurn(({ G, playerID }) => check(peekSpare(G, playerID))),
          client: false,
          undoable: false,
        },
        manualRoll: {
          move: ownTurn((c) => {
            log(c.G, `✋ ${nameOf(c.G, c.playerID)}: на кубике ${rollD12(c)}`);
          }),
          client: false,
          undoable: false,
        },
        manualEndTurn: {
          move: ownTurn(({ G, playerID, events }) => {
            if (G.play) {
              G.discard.push(G.play.cardId);
              G.play = null;
            }
            G.prompt = null;
            G.offers = [];
            log(G, `✋ ${nameOf(G, playerID)}: заканчивает ход без добора`);
            events.endTurn();
          }),
          client: false,
          undoable: false,
        },
        finishTurn: {
          move: turnOnly((c) => {
            if (canEndTurn(c.G, c.playerID)) return INVALID_MOVE;
            endTurnWithRefill(c);
          }),
          client: false,
          undoable: false,
        },
      },
    },
  },
};
