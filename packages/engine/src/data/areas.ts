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
