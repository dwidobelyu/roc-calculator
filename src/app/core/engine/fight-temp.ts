/** fight-temp.json: string-keyed fight-temp attributes damage_calculator.lua reads, and what sets them. */
export interface FightTempData {
  keys: { key: string; meaning: string; unit: string; default?: number; min?: number; max?: number; dcLine?: number }[];
  sources: FightTempSource[];
}

export interface FightTempSource {
  /** BuffTable id (the effectId gear / cards reference). */
  effectId: number;
  kind: 'buff' | 'equip' | 'card';
  name: string;
  /** Set only when the values come from this item's own buff params. */
  itemId?: number;
  sets: Record<string, number>;
  /** Snapshot copies: { BASE: SNAP } adds the BASE total into SNAP. */
  copies?: Record<string, string>;
  /** BuffEffectTable.TriggerCondition (skill, target, ... checks); informational. */
  condition?: string;
  /** Lowest refine level of the item that enables the values. */
  minRefine?: number;
}

/** An active buff: its id, or the id with the item that grants it and that item's refine level. */
export type ActiveEffect = number | { effectId: number; itemId?: number; refine?: number };

/** Sum the fight-temp values of the active buffs, then apply snapshot copies. */
export function fightTempFrom(sources: readonly FightTempSource[], effectIds: readonly ActiveEffect[]): Record<string, number> {
  const active = effectIds.map((e) => (typeof e === 'number' ? { effectId: e } : e));
  const out: Record<string, number> = {};
  const copies: [string, string][] = [];
  for (const s of sources) {
    const on = active.some((a) => a.effectId === s.effectId && (s.itemId === undefined || s.itemId === a.itemId) &&
      (a.refine ?? 0) >= (s.minRefine ?? 0));
    if (!on) continue;
    for (const [k, v] of Object.entries(s.sets)) out[k] = (out[k] ?? 0) + v;
    for (const [from, to] of Object.entries(s.copies ?? {})) if (!copies.some(([f, t]) => f === from && t === to)) copies.push([from, to]);
  }
  for (const [from, to] of copies) if (out[from]) out[to] = (out[to] ?? 0) + out[from];
  return out;
}
