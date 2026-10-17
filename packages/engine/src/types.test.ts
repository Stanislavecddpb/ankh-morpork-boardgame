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
