import { EquipmentEntry, StatBonus } from '../models/master-data.models';

/** card-levels.json: CardLevelTable.LevelUpAddAttr summed per (slot/quality) group (CardEvolutionMgr.GetCardAttr). */
export interface CardLevelData {
  maxLevel: number;
  /** Highest card level per star: index = star (0 -> 5, 1 -> 10, 2 -> 15); beyond the list, maxLevel. */
  starMaxLevel: number[];
  groups: Record<string, { level: number; attrs: StatBonus[] }[]>;
}

/** The level a card may reach at a star (CARD_STAR_MAX_LV[star + 1] or CARD_MAX_LV). */
export function cardMaxLevel(data: CardLevelData, star: number): number {
  return data.starMaxLevel[star] ?? data.maxLevel;
}

/** Lowest star that allows a level (CardEvolutionLevel 5|10|15: Lv.6 needs star 1, Lv.11 needs star 2). */
export function starForLevel(data: CardLevelData, level: number): number {
  const i = data.starMaxLevel.findIndex((max) => max >= level);
  return i < 0 ? data.starMaxLevel.length : i;
}

/**
 * Only awakened "+" cards level up and gain stars: CardEvolutionMgr.canLvUp / canStarUp require ItemTable
 * Subclass 403 (awakeCardSubclass); those are exactly the cards with star data. Base cards stay at level 0.
 */
export function canLevelCard(card: { levels?: readonly unknown[] } | undefined): boolean {
  return !!card?.levels?.length;
}

/** Bonus of a card at a level (totals up to that level; 0 = none), capped by what its star allows. */
export function cardLevelAttrs(data: CardLevelData, group: string | undefined, level: number, star: number): StatBonus[] {
  const lv = Math.min(level, cardMaxLevel(data, star));
  if (!group || lv <= 0) return [];
  return data.groups[group]?.findLast((l) => l.level <= lv)?.attrs ?? [];
}

/** inscriptions.json: Legendary Ornament accessories that take one Inscription gem, and the gems. */
export interface InscriptionGem {
  id: number;
  name: string;
  stat: string;
  quality: number | null;
  rare: boolean;
  season: number | null;
  attrs: StatBonus[];
  effects: { effectId: number; desc: string; script?: { effectType: number; param: string }[] }[];
}

export interface InscriptionData {
  ornamentIds: number[];
  gems: InscriptionGem[];
}

/**
 * Slots whose items all share one stat line in ROC (every Face, Mouth, Back and Fashion item has the same stats,
 * card slots and refine): the calculator offers one fixed item per slot instead of the item list.
 */
export const SHARED_LOOK_SLOTS: readonly number[] = [8, 9, 10, 15];
export const SHARED_LOOK_NAME = 'Face/Mouth/Back/Fashion';

/** The item a slot wears: the fixed shared-look item for Face/Mouth/Back/Fashion, otherwise the picked one. */
export function slotItemId(slot: number, equipId: number | null): number | null {
  return SHARED_LOOK_SLOTS.includes(slot) ? -slot : equipId;
}

const mode = <T>(xs: T[]): T => {
  const n = new Map<string, { v: T; c: number }>();
  for (const x of xs) { const k = JSON.stringify(x); const e = n.get(k) ?? n.set(k, { v: x, c: 0 }).get(k)!; e.c++; }
  return [...n.values()].sort((a, b) => b.c - a.c)[0].v;
};

/** Replace every item of a shared-look slot by one entry with the most common stats, card slots and refine. */
export function collapseSharedLookSlots(items: readonly EquipmentEntry[]): EquipmentEntry[] {
  const out = items.filter((e) => !SHARED_LOOK_SLOTS.includes(e.slot));
  for (const slot of SHARED_LOOK_SLOTS) {
    const own = items.filter((e) => e.slot === slot);
    if (!own.length) continue;
    // values below 0 are invalid table cells (e.g. -2146826246) and never the common case
    const valid = (k: 'holeNum' | 'refineMax' | 'refineGroup') => own.map((e) => e[k] ?? 0).filter((v) => v >= 0);
    out.push({
      id: -slot, name: SHARED_LOOK_NAME, slot, slotName: own[0].slotName,
      attrs: mode(own.map((e) => e.attrs ?? [])), holeNum: mode(valid('holeNum')),
      refineMax: mode(valid('refineMax')), refineGroup: mode(valid('refineGroup').filter((v) => v > 0)),
    });
  }
  return out;
}
