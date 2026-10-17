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
