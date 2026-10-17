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
  /** Карты, лежащие перед игроком (видны всем): Банк, Мистер Бент, Гильдия шутов… */
  front: string[];
}

/** Карта, которую сейчас разыгрывают: оставшиеся символы слева направо. */
export interface CardInPlay {
  cardId: string;
  queue: CardSymbol[];
  /** Кому карта уйдёт в руку после розыгрыша вместо сброса. */
  giveTo?: PlayerID;
  /** Перед кем карта ляжет после розыгрыша (зона front). */
  toFront?: PlayerID;
}

export interface GameOver {
  winner: PlayerID | null;
  reason: 'personality' | 'vimes' | 'score' | 'manual';
  personalities: Record<PlayerID, PersonalityId>;
  scores?: Record<PlayerID, number>;
}

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
  /** Неиспользованные личности (скрыты). */
  spare: PersonalityId[];
  prompt: Prompt | null;
  /** Последний ход свитка открыл скрытое/случайное — его нельзя отменить. */
  noUndo: boolean;
  /** Ручной просмотр неиспользованных личностей: виден только player. */
  peek: { player: PlayerID; cards: string[] } | null;
  /** Только в playerView: размеры скрытых колод. */
  deckCount?: number;
  eventsCount?: number;
  spareCount?: number;
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
