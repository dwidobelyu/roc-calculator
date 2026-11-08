/**
 * Constant tables copied from damage_calculator.lua. Indexes are game ids, not display order.
 * Copied from damage_calculator.lua.
 */

/** element_dam[attackElement][defenseElement], ids 0..10 (DC:5-149). */
export const ELEMENT_DAMAGE: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 0.7, 1, 1],
  [1, 0.25, 0.8, 1, 1.75, 1, 0.75, 1, 1, 1, 1],
  [1, 1.75, 0.25, 0.8, 1, 1, 0.75, 1, 1, 1, 1],
  [1, 1, 1.75, 0.25, 0.8, 1, 0.75, 1, 1, 1.5, 1],
  [1, 0.9, 1, 1.75, 0.25, 1, 0.75, 1, 1, 1, 1],
  [1, 1.25, 1.25, 1.25, 1.25, 0.25, 0.5, 0.5, 1, 0.25, 1],
  [1, 1, 1, 1, 1, 1, 0.25, 1.5, 1, 1.75, 1],
  [1, 1, 1, 1, 1, 0.5, 1.5, 0.25, 1, 0.25, 1],
  [0.7, 1, 1, 1, 1, 1, 0.75, 0.75, 1.5, 1.25, 1],
  [1, 1, 1, 1, 1, 0.5, 1.25, 0.25, 1, 0.25, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 0.7, 1, 1],
];

/** body_dam[weaponType][unitSize]; unit size ids: 0 Medium, 1 Large, 2 Small (DC:150-281). */
export const WEAPON_SIZE_DAMAGE: Readonly<Record<number, readonly [number, number, number]>> = {
  0: [1, 1, 1], 1: [0.75, 0.75, 1], 2: [1, 0.75, 0.75], 3: [0.75, 1, 0.75], 4: [0.75, 1, 0.75],
  5: [0.75, 1, 0.75], 6: [0.75, 1, 0.5], 7: [0.75, 1, 0.5], 8: [1, 1, 0.75], 9: [1, 1, 1],
  10: [1, 1, 1], 11: [1, 0.75, 1], 12: [1, 0.75, 1], 13: [1, 0.75, 0.75], 14: [1, 0.75, 0.75],
  15: [1, 0.5, 1], 16: [1, 0.75, 0.75], 17: [0.75, 1, 0.75], 19: [1, 0.75, 1], 20: [1, 1, 1],
  21: [1, 1, 1], 22: [1, 1, 1], 101: [0.75, 0.75, 1], 102: [1, 0.75, 0.75], 103: [0.75, 0.75, 0.75],
  104: [0.75, 0.75, 0.75],
};

/** pvpWeaponAtkPara[weaponType] (DC:1401-1429). */
export const PVP_WEAPON_ATK_FACTOR: Readonly<Record<number, number>> = {
  0: 1, 1: 0.6, 2: 0.75, 3: 1.3, 4: 0.75, 5: 1.2, 6: 0.66, 7: 1, 8: 0.7, 9: 0.58, 10: 0.88, 11: 0.8,
  12: 1, 13: 0.9, 14: 0.9, 15: 1, 16: 0.9, 17: 1, 18: 0.75, 19: 0.75, 20: 0.6, 21: 0.8, 22: 1,
  101: 0.8, 102: 1.2, 103: 1, 104: 1,
};

/** PvP damage-attribute difference curve [slope, x0, y0] per 300-point band (DC:1506-1552). */
export const PVP_DAM_CURVE: readonly (readonly [number, number, number])[] = [
  [7.75e-5, 0, 0], [3.75e-5, 300, 0.04], [5.25e-5, 600, 0.06], [2.25e-5, 900, 0.08],
  [3.5e-5, 1200, 0.1], [1.5e-5, 1500, 0.12], [1.75e-5, 1800, 0.15], [7.5e-6, 2100, 0.18], [0, 0, 0.2],
];

/** Weapon type names from EquipWeaponTable. */
export const WEAPON_TYPES: Readonly<Record<number, string>> = {
  0: 'Unarmed', 1: 'Dagger', 2: 'One-handed Sword', 3: 'Two-handed Sword', 4: 'One-handed Spear',
  5: 'Two-handed Spear', 6: 'One-handed Axe', 7: 'Two-handed Axe', 8: 'Mace', 9: 'Wand', 10: 'Staff',
  11: 'Bow', 12: 'Knuckles', 13: 'Instrument', 14: 'Whip', 15: 'Book', 16: 'Katar', 17: 'Shield',
  18: 'Off-hand', 19: 'Crossbow Blade', 20: 'Foxtail', 21: 'Attache Case', 22: 'Attache Case',
  // 101-104 are dual-wield combinations; which pair each id stands for is not in the readable data
  101: 'Dual wield 101', 102: 'Dual wield 102', 103: 'Dual wield 103', 104: 'Dual wield 104',
};

/** EntityTable.UnitTypeLevel values, named from the monsters that carry them (inferred). */
export const MONSTER_RANKS: Readonly<Record<number, string>> = {
  0: 'Normal', 1: 'Elite', 2: 'Special', 3: 'Variant', 4: 'Mini-boss', 5: 'MVP', 9: 'Training dummy',
  21: 'Invading MVP',
};

/** Ranks treated as boss-type for "DMG vs BOSS" / "Reduction vs BOSS" attributes (inferred). */
export const BOSS_RANKS: readonly number[] = [4, 5, 21];
