import type { AreaId } from '../types';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Цена постройки здания — как напечатано на поле русского издания (в английском оригинале дорогие районы стоят $18). */
  cost: number;
  /** Соседние районы (общая граница или мост). */
  adjacent: AreaId[];
  /** Граничит с рекой Анк (для Наводнения). */
  river: boolean;
}

export const AREAS: AreaDef[] = [
  { id: 1, name: 'Сестры Долли', cost: 6, adjacent: [2, 3, 12], river: true },
  { id: 2, name: 'Внедвижимость', cost: 17, adjacent: [1, 3, 4, 10, 11, 12], river: true },
  { id: 3, name: 'Драконья посадка', cost: 12, adjacent: [1, 2, 4], river: false },
  { id: 4, name: 'Мелкие Боги', cost: 17, adjacent: [2, 3, 5, 6, 10], river: false },
  { id: 5, name: 'Сточный район', cost: 6, adjacent: [4, 6, 7, 10], river: true },
  { id: 6, name: 'Стадион Гиппо', cost: 12, adjacent: [4, 5, 7], river: false },
  { id: 7, name: 'Тени', cost: 6, adjacent: [5, 6, 8, 10], river: true },
  { id: 8, name: 'Мраколодец', cost: 6, adjacent: [7, 9, 10], river: true },
  { id: 9, name: 'Длинная Стена', cost: 12, adjacent: [8, 10, 11], river: true },
  { id: 10, name: 'Остров Богов', cost: 12, adjacent: [2, 4, 5, 7, 8, 9, 11], river: true },
  { id: 11, name: 'Семеро спящих', cost: 17, adjacent: [2, 9, 10, 12], river: true },
  { id: 12, name: 'Сонные холмы', cost: 12, adjacent: [1, 2, 11], river: true },
];

export const AREA_IDS: AreaId[] = AREAS.map((a) => a.id);
export const areaDef = (id: AreaId): AreaDef => AREAS[id - 1];

/** Сестры Долли, Сточный район, Тени: по слуге каждого игрока и жетону беспорядка. */
export const START_AREAS: AreaId[] = [1, 5, 7];
