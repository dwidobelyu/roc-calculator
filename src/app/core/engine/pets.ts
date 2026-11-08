import { StatBonus } from '../models/master-data.models';

/** Pet level cap (Ragnarok Origin Classic max level). */
export const PET_MAX_LEVEL = 99;

export interface PetEntry {
  id: number;
  name: string;
  /** PetRankUpTable rows in order: owner bonus (attrs) and permanent owner bonus (foreverAttrs), summed per step. */
  starLevels: { rank: number; rankUp: number; attrs: StatBonus[]; foreverAttrs: StatBonus[] }[];
  /** PetEvolutionTable per rank: fightAttrs while deployed, assistAttrs while assisting. */
  evolution?: { rank: number; fightAttrs: StatBonus[]; assistAttrs: StatBonus[] }[];
}

/**
 * Evolution bonus at a rank for a deployed or an assist pet. Inferred: PetEvolutionTable may no longer be live
 * (only BDTrainGroundMgr reads it client-side); the real assist bonus is sent by the server.
 */
export function petEvolutionAttrs(pet: PetEntry, rank: number, state: 'deployed' | 'assist'): StatBonus[] {
  const row = pet.evolution?.findLast((e) => e.rank <= rank);
  return (state === 'deployed' ? row?.fightAttrs : row?.assistAttrs) ?? [];
}

/** Highest evolution rank in the data (0 when the pet has none). */
export function petMaxEvolution(pet: PetEntry): number {
  return pet.evolution?.at(-1)?.rank ?? 0;
}

export interface PetLevelData {
  maxLevel: number;
  /** Attribute ids of each delta column (pet's own level-up HP, ATK, MATK, ...). */
  attrs: number[];
  /** PetTable id -> LevelUpAttrGroupId. */
  petGroup: Record<string, number>;
  /** Group id -> per-level deltas (index 0 = level 1). */
  deltas: Record<string, number[][]>;
}

/** The pet's own level-up stats at a level: sum of the per-level rows (pet only, not added to the owner). */
export function petOwnStats(data: PetLevelData, petId: number, level: number): StatBonus[] {
  const rows = data.deltas[data.petGroup[petId]] ?? [];
  const totals = data.attrs.map(() => 0);
  rows.slice(0, Math.min(level, data.maxLevel)).forEach((row) => row.forEach((v, i) => (totals[i] += v)));
  return data.attrs.map((attr, i) => ({ attr, value: totals[i] }));
}
