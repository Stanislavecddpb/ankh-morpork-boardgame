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
