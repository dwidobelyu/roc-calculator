import { StatBonus } from '../models/master-data.models';

/** Arrow item (ItemFunctionTable.ItemFunction 8). `element` is a UnitAttrType id 0..10. */
export interface AmmoEntry {
  id: number;
  name: string;
  element: number;
  /** While loaded: e.g. ATTR_BASIC_WEAPON_ATK (27). */
  attrs: StatBonus[];
  /** On-hit debuff on the target (BuffTable id, chance x10000), applied server-side. */
  buff: { id: number; chance: number } | null;
  /** ItemTable.Profession ([[0,0]] = any job). */
  profession: number[][];
  weaponTypes: number[];
}

/** Ammo that can be loaded with this weapon type (arrows: Bow 11 only, ArrowMgr.IsWearBow). */
export const ammoFor = (weaponType: number, all: readonly AmmoEntry[]): AmmoEntry[] =>
  all.filter((a) => a.weaponTypes.includes(weaponType));
