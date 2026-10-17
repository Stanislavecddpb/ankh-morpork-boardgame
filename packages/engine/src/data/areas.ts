import type { AreaId } from '../types';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Цена постройки здания (как в оригинале; на поле русского издания напечатано $17). */
  cost: number;
  /** Соседние районы (общая граница или мост). */
  adjacent: AreaId[];
}

export const AREAS: AreaDef[] = [
  { id: 1, name: 'Сестры Долли', cost: 6, adjacent: [2, 3, 12] },
  { id: 2, name: 'Внедвижимость', cost: 18, adjacent: [1, 3, 4, 10, 11, 12] },
  { id: 3, name: 'Драконья посадка', cost: 12, adjacent: [1, 2, 4] },
  { id: 4, name: 'Мелкие Боги', cost: 18, adjacent: [2, 3, 5, 6, 10] },
  { id: 5, name: 'Сточный район', cost: 6, adjacent: [4, 6, 7, 10] },
  { id: 6, name: 'Стадион Гиппо', cost: 12, adjacent: [4, 5, 7] },
  { id: 7, name: 'Тени', cost: 6, adjacent: [5, 6, 8, 10] },
  { id: 8, name: 'Мраколодец', cost: 6, adjacent: [7, 9, 10] },
  { id: 9, name: 'Длинная Стена', cost: 12, adjacent: [8, 10, 11] },
  { id: 10, name: 'Остров Богов', cost: 12, adjacent: [2, 4, 5, 7, 8, 9, 11] },
  { id: 11, name: 'Семеро спящих', cost: 18, adjacent: [2, 9, 10, 12] },
  { id: 12, name: 'Сонные холмы', cost: 12, adjacent: [1, 2, 11] },
];

export const AREA_IDS: AreaId[] = AREAS.map((a) => a.id);
export const areaDef = (id: AreaId): AreaDef => AREAS[id - 1];

/** Сестры Долли, Сточный район, Тени: по слуге каждого игрока и жетону беспорядка. */
export const START_AREAS: AreaId[] = [1, 5, 7];
