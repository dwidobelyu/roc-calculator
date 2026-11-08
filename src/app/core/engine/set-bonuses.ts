import { PlayerBuild } from '../models/build.models';
import { StatBonus } from '../models/master-data.models';
import type { Catalog } from '../services/catalog.service';
import { FEATHER_SLOTS, featherLevel } from './feathers';
import { countedEnchants } from './item-options';
import { slotItemId } from './item-upgrades';
import { MAX_BASE_LEVEL } from './stat-points';

/** One tier of a gear set: active when `pieces` items each reach `threshold` (refine/enhance/enchant level). */
export interface GearSetTier {
  id: number;
  name: string;
  pieces: number;
  threshold: number;
  attrs: StatBonus[];
  effects?: { effectId: number }[];
}

export interface FeatherSuit {
  id: number;
  name: string;
  hole: number;
  /** Required feather count per colour. */
  colors: Record<string, number>;
  levels: { level: number; attack: number[][]; defense: number[][]; mix: number[][] }[];
}

export interface FeatherSuitData {
  suits: FeatherSuit[];
  /** AttributeClassifyTable: class id -> attr ids a type-5 suit entry boosts. */
  classes: Record<string, number[]>;
}

export interface ActiveSet {
  label: string;
  attrs: StatBonus[];
}

/**
 * Highest tier whose piece count is met (the game lists tiers as Echo I..XII, Syntony I..XV; only the best one is
 * shown active) [inferred: the set check runs on the server].
 */
export function bestTier(tiers: readonly GearSetTier[], levels: readonly number[]): GearSetTier | undefined {
  return [...tiers]
    .filter((t) => levels.filter((lv) => lv >= t.threshold).length >= t.pieces)
    .sort((a, b) => b.threshold - a.threshold || b.pieces - a.pieces)[0];
}

/** EquipTable positions the refine set counts (SuitPart 0-10 and 15); Trolley (12) and Battle Bird (14) do not count. */
const REFINE_SET_SLOTS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]);

/** Refine, enhance and enchant set bonuses of the equipped gear. */
export function gearSetBonuses(build: PlayerBuild, cat: Catalog): ActiveSet[] {
  const worn = build.equipment.filter((s) => slotItemId(s.slot, s.equipId) != null);
  const enchantLevel = (s: (typeof worn)[number]) => Math.max(0, ...countedEnchants(s.enchants).map((e) => e.amount));
  const sets: [string, readonly GearSetTier[], number[]][] = [
    ['Refine set', cat.refineSets, worn.filter((s) => REFINE_SET_SLOTS.has(s.slot)).map((s) => s.refine)],
    ['Enhance set', cat.enhanceSets, worn.map((s) => s.enhance)],
    ['Enchant set', cat.enchantSets, worn.map(enchantLevel)],
  ];
  return sets.flatMap(([label, tiers, levels]) => {
    const t = bestTier(tiers, levels);
    if (!t) return [];
    const buffAttrs = (t.effects ?? []).flatMap((e) => cat.equipBuffAttrs.get(e.effectId) ?? []);
    const met = levels.filter((lv) => lv >= t.threshold).length;
    return [{ label: `${label}: ${t.name} (${met}/${t.pieces} at +${t.threshold})`, attrs: [...t.attrs, ...buffAttrs] }];
  });
}

/**
 * Feather sets per statue group (StatueMgr.GetJewelSuitTableData): colour counts and the lowest feather level pick
 * the set; the group type (attack/defense) picks its attribute list. Type-5 entries scale the group's own feather
 * attrs in that attribute class by value/10000.
 */
export function featherSetBonuses(build: PlayerBuild, cat: Catalog): ActiveSet[] {
  const out: ActiveSet[] = [];
  const baseLevel = Math.min(build.baseLevel, MAX_BASE_LEVEL);
  for (const group of ['attack', 'defense'] as const) {
    const placed = FEATHER_SLOTS.flatMap((slot, i) => {
      const pick = build.feathers?.[i];
      const kind = pick ? cat.featherById.get(pick.kindId) : undefined;
      return slot.group === group && pick && kind && slot.accepts.includes(kind.type) ? [{ kind, level: pick.level }] : [];
    });
    if (!placed.length) continue;
    const counts: Record<string, number> = {};
    for (const p of placed) counts[p.kind.color] = (counts[p.kind.color] ?? 0) + 1;
    const level = Math.min(...placed.map((p) => featherLevel(p.level, p.kind, baseLevel)));
    const suit = cat.featherSuits.suits
      .filter((s) => Object.entries(s.colors).every(([c, n]) => (counts[c] ?? 0) >= n))
      .sort((a, b) => b.hole - a.hole)[0];
    const row = suit?.levels.find((l) => l.level === level);
    if (!suit || !row) continue;
    const attrs: StatBonus[] = [];
    for (const [type, id, value] of group === 'attack' ? row.attack : row.defense) {
      if (type === 0) attrs.push({ attr: id, value });
      if (type === 5) {
        // boost the group's own feather attrs that fall in the class
        const inClass = new Set(cat.featherSuits.classes[id] ?? []);
        for (const p of placed) {
          for (const a of p.kind.levels.find((l) => l.level === featherLevel(p.level, p.kind, baseLevel))?.attrs ?? []) {
            if (inClass.has(a.attr)) attrs.push({ attr: a.attr, value: Math.floor((a.value * value) / 10000) });
          }
        }
      }
    }
    out.push({ label: `${group === 'attack' ? 'Attack' : 'Defense'} feather set: ${suit.name} Lv.${level}`, attrs });
  }
  return out;
}

