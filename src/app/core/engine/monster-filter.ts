import { MonsterEntry } from '../models/master-data.models';

/** Rank groups players think in; each maps to EntityTable.UnitTypeLevel values (names inferred from monsters). */
export const RANK_GROUPS: readonly { key: string; label: string; ranks: number[] }[] = [
  { key: 'normal', label: 'Normal', ranks: [0] },
  { key: 'elite', label: 'Elite', ranks: [1] },
  { key: 'mini', label: 'Mini-boss', ranks: [4] },
  { key: 'mvp', label: 'MVP', ranks: [5, 21] },
  { key: 'other', label: 'Other (special, variants, dummies)', ranks: [2, 3, 9] },
];

export interface MonsterFilterState {
  /** Name or exact id. */
  query: string;
  rank: string;
  race: number | null;
  element: number | null;
  size: number | null;
  minLevel: number | null;
  maxLevel: number | null;
}

export const EMPTY_MONSTER_FILTER: MonsterFilterState = {
  query: '', rank: '', race: null, element: null, size: null, minLevel: null, maxLevel: null,
};

export function rankLabel(rank: number): string {
  return RANK_GROUPS.find((g) => g.ranks.includes(rank))?.label ?? `Rank ${rank}`;
}

export type FilterableMonster = Pick<MonsterEntry, 'id' | 'name' | 'level' | 'rank' | 'race' | 'element' | 'size'>;

export function matchesMonster(m: FilterableMonster, f: MonsterFilterState): boolean {
  const q = f.query.trim().toLowerCase();
  const ranks = RANK_GROUPS.find((g) => g.key === f.rank)?.ranks;
  return (!q || m.name.toLowerCase().includes(q) || String(m.id) === q) &&
    (!ranks || ranks.includes(m.rank)) &&
    (f.race == null || m.race === f.race) &&
    (f.element == null || m.element === f.element) &&
    (f.size == null || m.size === f.size) &&
    (f.minLevel == null || m.level >= f.minLevel) &&
    (f.maxLevel == null || m.level <= f.maxLevel);
}

export function isFilterActive(f: MonsterFilterState): boolean {
  return Object.entries(f).some(([k, v]) => (k === 'query' || k === 'rank' ? !!v : v != null));
}
