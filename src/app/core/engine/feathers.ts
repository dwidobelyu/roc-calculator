import { LeveledBonus, StatBonus } from '../models/master-data.models';

/** A feather (statue jewel) kind: StatueJewelTable rows grouped by JewelSourceID. */
export interface FeatherKind {
  id: number;
  name: string;
  type: 'ATK' | 'DEF' | 'MIX';
  quality: number;
  /** Feather colour (StatueJewelInfoTable.Color); feather sets count feathers per colour. */
  color: number;
  /** [baseLevel, max feather level] pairs (StatueJewelInfoTable.UpgradeMaxLevelByRoleLv). */
  levelCap: [number, number][];
  /** Totals at each level. */
  levels: LeveledBonus[];
}

export interface FeatherSlotDef {
  label: string;
  group: 'attack' | 'defense';
  accepts: readonly FeatherKind['type'][];
}

/** 5 attack slots (ATK or MIX feathers) and 5 defense slots (DEF or MIX): the statues that hold feathers. */
export const FEATHER_SLOTS: readonly FeatherSlotDef[] = [
  ...[1, 2, 3, 4, 5].map((n) => ({ label: `Attack feather ${n}`, group: 'attack' as const, accepts: ['ATK', 'MIX'] as const })),
  ...[1, 2, 3, 4, 5].map((n) => ({ label: `Defense feather ${n}`, group: 'defense' as const, accepts: ['DEF', 'MIX'] as const })),
];

/** Highest feather level allowed at this base level, never above the kind's last row. */
export function featherMaxLevel(kind: FeatherKind, baseLevel: number): number {
  const byLevel = kind.levelCap.filter(([lv]) => lv <= baseLevel).at(-1)?.[1] ?? 0;
  const rows = kind.levels.at(-1)?.level ?? 0;
  return kind.levelCap.length ? Math.min(byLevel, rows) : rows;
}

/**
 * The level a placed feather counts at: its chosen level, capped by what the base level allows. Level 0 (picked
 * before the base level unlocked feathers) means "the highest level allowed".
 */
export function featherLevel(level: number, kind: FeatherKind, baseLevel: number): number {
  const max = featherMaxLevel(kind, baseLevel);
  return Math.min(level || max, max);
}

export function featherAttrs(kind: FeatherKind, level: number): StatBonus[] {
  return kind.levels.find((l) => l.level === level)?.attrs ?? [];
}
