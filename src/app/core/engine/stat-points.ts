import { Attr } from '../models/attr';
import { BaseStats } from '../models/build.models';
import { StatPointRules } from '../models/master-data.models';

/** Highest base level the calculator allows. */
export const MAX_BASE_LEVEL = 99;

const STAT_ATTR: Record<keyof BaseStats, number> = {
  str: Attr.STR, agi: Attr.AGI, vit: Attr.VIT, int: Attr.INT, dex: Attr.DEX, luk: Attr.LUK,
};

/** Stat points owned at a base level (running sum of AttrPointBaseLvTable). */
export function pointsAt(rules: StatPointRules, level: number): number {
  return rules.pointsAtLevel[Math.min(level, MAX_BASE_LEVEL)] ?? 0;
}

/** Points spent to have one stat at a value (running sum of AttrPointNeed). */
export function costOf(rules: StatPointRules, value: number): number {
  return rules.costToReach[value] ?? Infinity;
}

export function spent(rules: StatPointRules, stats: BaseStats): number {
  return (Object.keys(STAT_ATTR) as (keyof BaseStats)[]).reduce((sum, k) => sum + costOf(rules, stats[k]), 0);
}

/** AttributeAttrLimit bounds for a stat (1..99). */
export function statBounds(rules: StatPointRules, key: keyof BaseStats): { min: number; max: number } {
  const l = rules.limits.find((x) => x.attr === STAT_ATTR[key]);
  return { min: l?.min ?? 1, max: l?.max ?? 99 };
}

/** The highest value this stat can reach with the points left, keeping the other stats as they are. */
export function maxAffordable(rules: StatPointRules, stats: BaseStats, key: keyof BaseStats, level: number): number {
  const { min, max } = statBounds(rules, key);
  const budget = pointsAt(rules, level) - spent(rules, stats) + costOf(rules, stats[key]);
  let v = min;
  while (v < max && costOf(rules, v + 1) <= budget) v++;
  return Math.max(v, Math.min(stats[key], max)); // never below the current value, so lowering stays possible
}
