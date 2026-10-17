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
